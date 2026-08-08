import { Config, ConfigCredential } from '../fast-sfdc'
import * as path from 'upath'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { SecretStorage } from 'vscode'
import utils from '../utils/utils'

const CONFIG_NAME = 'fastsfdc.json'
const SFDY_CONFIG_NAME = '.sfdy.json'

const getCfgPath = () => path.join(utils.getWorkspaceFolder(), CONFIG_NAME)
const getSfdyCfgPath = () => path.join(utils.getWorkspaceFolder(), SFDY_CONFIG_NAME)
const SECRET_FIELDS = ['username', 'password', 'instanceUrl'] as const
let secrets: SecretStorage | undefined
let migratedCredentials = false
let configCache: Config | undefined
let configCachePath: string | undefined

type SecretField = typeof SECRET_FIELDS[number]
type CredentialSecret = Partial<Pick<ConfigCredential, SecretField>>

const secretKey = (credentialId: string) => `credential.${credentialId}`
const newCredentialId = () => crypto.randomBytes(16).toString('hex')
const getSecrets = (): SecretStorage => {
  if (!secrets) throw new Error('Fast-Sfdc secret storage has not been initialized')
  return secrets
}
const readStoredConfig = (): Config => {
  const cfgPath = getCfgPath()
  if (!fs.existsSync(cfgPath)) return { stored: false, credentials: [], currentCredential: 0 }
  return { ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')), stored: true }
}
const withoutSecrets = (credential: ConfigCredential): ConfigCredential => {
  const sanitized = { ...credential }
  SECRET_FIELDS.forEach(field => delete sanitized[field])
  return sanitized
}
const getCredentialSecret = (credential: ConfigCredential): CredentialSecret => Object.fromEntries(
  SECRET_FIELDS.filter(field => credential[field] !== undefined).map(field => [field, credential[field]])
) as CredentialSecret
const parseSecret = (value: string | undefined): CredentialSecret => {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch (_) {
    return {}
  }
}
const normalizeCredential = (credential: ConfigCredential): ConfigCredential => {
  if (!credential.id) credential.id = newCredentialId()
  return credential
}
const cloneConfig = (config: Config): Config => ({
  ...config,
  credentials: config.credentials.map(credential => ({ ...credential }))
})

export default {
  initialize (secretStorage: SecretStorage) {
    secrets = secretStorage
  },
  consumeCredentialMigrationNotice (): boolean {
    const migrated = migratedCredentials
    migratedCredentials = false
    return migrated
  },
  getConfigPath: getCfgPath,
  getConfigFileName: () => { return CONFIG_NAME },
  getSfdyConfigPath: getSfdyCfgPath,
  getSfdyConfigSync (): SfdyConfig {
    const cfgPath = getSfdyCfgPath()
    if (!fs.existsSync(cfgPath)) {
      return { stored: false, staticResources: { useBundleRenderer: [] }, excludeFiles: ['lwc/**/__tests__/**/*'] }
    } else {
      const storedCfg = fs.readFileSync(cfgPath, 'utf8')
      return { ...JSON.parse(storedCfg), stored: true }
    }
  },
  getConfigSync (): Config {
    if (configCache && configCachePath === getCfgPath()) return cloneConfig(configCache)
    const config = readStoredConfig()
    return { ...config, credentials: config.credentials.map(withoutSecrets) }
  },

  async getConfig (): Promise<Config> {
    const config = readStoredConfig()
    if (!config.stored) {
      configCache = config
      configCachePath = getCfgPath()
      return cloneConfig(config)
    }

    let needsMigration = false
    const credentials = await Promise.all(config.credentials.map(async storedCredential => {
      const hadCredentialId = !!storedCredential.id
      const credential = normalizeCredential(storedCredential)
      const legacySecret = getCredentialSecret(credential)
      const hasLegacySecret = Object.keys(legacySecret).length > 0
      const storedSecret = parseSecret(await getSecrets().get(secretKey(credential.id!)))

      if (!hadCredentialId || hasLegacySecret) {
        await getSecrets().store(secretKey(credential.id!), JSON.stringify({ ...storedSecret, ...legacySecret }))
        needsMigration = true
      }
      return { ...withoutSecrets(credential), ...storedSecret, ...legacySecret }
    }))

    if (needsMigration) {
      await utils.writeFile(getCfgPath(), JSON.stringify({
        ...config,
        credentials: credentials.map(withoutSecrets),
        stored: undefined
      }, undefined, 2))
      migratedCredentials = true
    }
    configCache = { ...config, credentials, stored: true }
    configCachePath = getCfgPath()
    return cloneConfig(configCache)
  },

  async storeConfig (cfg: Config): Promise<void> {
    const previousConfig = readStoredConfig()
    const credentials = cfg.credentials.map(normalizeCredential)
    const credentialIds = new Set(credentials.map(credential => credential.id))

    await Promise.all(credentials.map(async credential => {
      const secret = getCredentialSecret(credential)
      if (Object.keys(secret).length > 0) {
        await getSecrets().store(secretKey(credential.id!), JSON.stringify(secret))
      }
    }))

    await utils.writeFile(getCfgPath(), JSON.stringify({
      ...cfg,
      credentials: credentials.map(withoutSecrets),
      stored: undefined
    }, undefined, 2))

    configCache = { ...cfg, credentials, stored: true }
    configCachePath = getCfgPath()

    await Promise.all(previousConfig.credentials
      .filter(credential => credential.id && !credentialIds.has(credential.id))
      .map(credential => getSecrets().delete(secretKey(credential.id!))))
  },

  async storeSfdyConfig (cfg: SfdyConfig): Promise<void> {
    await utils.writeFile(getSfdyCfgPath(), JSON.stringify({ ...cfg, stored: undefined }, undefined, 2))
  },

  async getPackageXmlVersion (): Promise<string> {
    const p = path.join(utils.getWorkspaceFolder(), 'src', 'package.xml')
    const pJson = await utils.parseXmlStrict<{version: string}>(await utils.readFile(p))
    return pJson.version
  }
}
