import { Config, ConfigCredential } from '../fast-sfdc'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { SecretStorage } from 'vscode'
import * as sharedCredentials from 'sfdy/credentials'
import utils from '../utils/utils'
import { resolveSourceLayout } from './source-layout-service'
import { fromSharedCredential, StoredFastConfig, toSharedCredential, toStoredFastConfig } from './credential-bridge'
import { reserveUniqueCredentialAlias } from './credential-label-service'

const CONFIG_NAME = path.join('.sfdy', 'fast-sfdc.json')
const LEGACY_CONFIG_NAME = 'fastsfdc.json'
const SFDY_CONFIG_NAME = '.sfdy.json'

const getCfgPath = () => path.join(utils.getWorkspaceFolder(), CONFIG_NAME)
const getLegacyCfgPath = () => path.join(utils.getWorkspaceFolder(), LEGACY_CONFIG_NAME)
const getSfdyCfgPath = () => path.join(utils.getWorkspaceFolder(), SFDY_CONFIG_NAME)
const SECRET_FIELDS = ['username', 'password', 'instanceUrl', 'clientSecret'] as const
let secrets: SecretStorage | undefined
let migratedCredentials = false
let configCache: Config | undefined
let configCachePath: string | undefined
let credentialManager: sharedCredentials.CredentialManager | undefined
let credentialManagerPath: string | undefined

type SecretField = typeof SECRET_FIELDS[number]
type CredentialSecret = Partial<Pick<ConfigCredential, SecretField>>

const secretKey = (credentialId: string) => `credential.${credentialId}`
const newCredentialId = () => crypto.randomBytes(16).toString('hex')
const newEnvironment = (used: Set<string>): string => {
  let environment: string
  do environment = `env-${crypto.randomBytes(4).toString('hex')}`
  while (used.has(environment.toLowerCase()))
  used.add(environment.toLowerCase())
  return environment
}
const getSecrets = (): SecretStorage => {
  if (!secrets) throw new Error('Fast-Sfdc secret storage has not been initialized')
  return secrets
}
const readStoredConfig = (): StoredFastConfig & {stored: boolean; legacy?: boolean} => {
  if (fs.existsSync(getCfgPath())) {
    return { ...JSON.parse(fs.readFileSync(getCfgPath(), 'utf8')), stored: true }
  }
  if (fs.existsSync(getLegacyCfgPath())) {
    return { ...JSON.parse(fs.readFileSync(getLegacyCfgPath(), 'utf8')), stored: true, legacy: true }
  }
  return { stored: false }
}
const getCredentialManager = (): sharedCredentials.CredentialManager => {
  const workspacePath = utils.getWorkspaceFolder()
  if (!credentialManager || credentialManagerPath !== workspacePath) {
    credentialManager = sharedCredentials.createCredentialManager({ basePath: workspacePath })
    credentialManagerPath = workspacePath
  }
  return credentialManager
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
const storeLocalConfig = async (cfg: Config): Promise<void> => {
  await utils.writeFile(getCfgPath(), JSON.stringify(toStoredFastConfig(cfg), undefined, 2))
  await fs.promises.unlink(getLegacyCfgPath()).catch(error => {
    if (error.code !== 'ENOENT') throw error
  })
}
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
    return { stored: false, credentials: [], currentCredential: 0 }
  },

  async getConfig (): Promise<Config> {
    const config = readStoredConfig()
    const credentialsVault = getCredentialManager()
    const globalProfiles = await credentialsVault.list()
    const usedEnvironments = new Set(globalProfiles
      .map(profile => profile.environment)
      .filter((environment): environment is string => !!environment)
      .map(environment => environment.toLowerCase()))
    for (const profile of globalProfiles.filter(profile => !profile.environment)) {
      await credentialsVault.save({
        ...await credentialsVault.get(profile.id),
        environment: newEnvironment(usedEnvironments)
      })
    }
    const migratedProfiles = await credentialsVault.list()
    const globalByAlias = new Map(migratedProfiles.map(profile => [profile.alias.toLowerCase(), profile]))
    const usedAliases = new Set(migratedProfiles.map(profile => profile.alias.trim().toLowerCase()))
    const localCredentials = (config.credentials || []).map(normalizeCredential)
    let needsMigration = config.legacy === true || Array.isArray(config.credentials) || config.currentCredential !== undefined
    let migratedLegacyCredentials = false

    for (const credential of localCredentials) {
      const legacyCredentialId = credential.id!
      const legacySecret = getCredentialSecret(credential)
      const storedSecret = parseSecret(await getSecrets().get(secretKey(legacyCredentialId)))
      const secret = { ...storedSecret, ...legacySecret }
      if (Object.keys(secret).length === 0) continue

      const hydrated = { ...credential, ...secret }
      if (hydrated.alias) hydrated.alias = hydrated.alias.trim()
      if (hydrated.environment) hydrated.environment = hydrated.environment.trim()
      const existing = hydrated.alias ? globalByAlias.get(hydrated.alias.toLowerCase()) : undefined
      const usernameMatches = hydrated.username ? migratedProfiles.filter(profile => profile.username === hydrated.username) : []
      const existingByUsername = usernameMatches.length === 1 ? usernameMatches[0] : undefined
      const matchingProfile = existing || existingByUsername
      if (matchingProfile) {
        hydrated.id = matchingProfile.id
        hydrated.alias = matchingProfile.alias
        hydrated.environment = hydrated.environment || matchingProfile.environment || newEnvironment(usedEnvironments)
      } else {
        if (!hydrated.environment) hydrated.environment = newEnvironment(usedEnvironments)
        hydrated.alias = reserveUniqueCredentialAlias(hydrated.alias || hydrated.environment, usedAliases)
      }
      const saved = await credentialsVault.save(toSharedCredential(hydrated))
      credential.id = saved.id
      credential.alias = saved.alias
      await getSecrets().delete(secretKey(legacyCredentialId))
      needsMigration = true
      migratedLegacyCredentials = true
    }

    const profiles = await credentialsVault.list()
    const localById = new Map(localCredentials.map(credential => [credential.id, credential]))
    const localByAlias = new Map(localCredentials
      .filter(credential => credential.alias)
      .map(credential => [credential.alias!.toLowerCase(), credential]))
    const credentials = await Promise.all(profiles.map(async profile => fromSharedCredential(
      await credentialsVault.get(profile.id),
      {
        ...(localById.get(profile.id) || localByAlias.get(profile.alias.toLowerCase())),
        ...config.credentialSettings?.[profile.id]
      }
    )))

    const configuredCredential = localCredentials[config.currentCredential || 0]
    let currentCredential = config.currentCredentialId
      ? credentials.findIndex(credential => credential.id === config.currentCredentialId)
      : configuredCredential
        ? credentials.findIndex(credential => credential.id === configuredCredential.id || credential.alias === configuredCredential.alias)
        : 0
    if (currentCredential < 0) currentCredential = 0

    const hydratedConfig: Config = {
      stored: credentials.length > 0,
      credentials,
      currentCredential
    }
    if (needsMigration) {
      await storeLocalConfig(hydratedConfig)
      if (migratedLegacyCredentials) migratedCredentials = true
    }
    configCache = hydratedConfig
    configCachePath = getCfgPath()
    return cloneConfig(hydratedConfig)
  },

  async storeConfig (cfg: Config): Promise<void> {
    const credentialsVault = getCredentialManager()
    const previousCredentials = configCache && configCachePath === getCfgPath() ? configCache.credentials : []
    const storedCredentials: ConfigCredential[] = []
    for (const credential of cfg.credentials) {
      const saved = await credentialsVault.save(toSharedCredential(credential))
      credential.id = saved.id
      credential.alias = saved.alias
      storedCredentials.push(credential)
      await getSecrets().delete(secretKey(saved.id))
    }

    const credentialIds = new Set(storedCredentials.map(credential => credential.id))
    await Promise.all(previousCredentials
      .filter(credential => credential.id && !credentialIds.has(credential.id))
      .map(credential => credentialsVault.remove(credential.id!)))

    const storedConfig = { ...cfg, credentials: storedCredentials }
    await storeLocalConfig(storedConfig)
    configCache = { ...storedConfig, stored: true }
    configCachePath = getCfgPath()
  },

  async storeSfdyConfig (cfg: SfdyConfig): Promise<void> {
    await utils.writeFile(getSfdyCfgPath(), JSON.stringify({ ...cfg, stored: undefined }, undefined, 2))
  },

  async getPackageXmlVersion (): Promise<string> {
    const workspaceRoot = utils.getWorkspaceFolder()
    const sfdyConfig = this.getSfdyConfigSync()
    const layout = resolveSourceLayout(workspaceRoot, sfdyConfig)
    if (layout.apiVersion) return layout.apiVersion
    const p = path.join(layout.root, 'package.xml')
    const pJson = await utils.parseXmlStrict<{version: string}>(await utils.readFile(p))
    return pJson.version
  }
}
