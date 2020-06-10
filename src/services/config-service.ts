import { Config } from '../fast-sfdc'
import * as path from 'upath'
import * as fs from 'fs'
import utils from '../utils/utils'

const CONFIG_NAME = 'fastsfdc.json'
const SFDY_CONFIG_NAME = '.sfdy.json'

const getCfgPath = () => path.join(utils.getWorkspaceFolder(), CONFIG_NAME)
const getSfdyCfgPath = () => path.join(utils.getWorkspaceFolder(), SFDY_CONFIG_NAME)

export default {
  getConfigPath: getCfgPath,
  getConfigFileName: () => { return CONFIG_NAME },
  getSfdyConfigPath: getSfdyCfgPath,
  getSfdyConfigSync (): SfdyConfig {
    const cfgPath = getSfdyCfgPath()
    if (!fs.existsSync(cfgPath)) {
      return { stored: false, staticResources: { useBundleRenderer: [] } }
    } else {
      const storedCfg = fs.readFileSync(cfgPath, 'utf8')
      return { ...JSON.parse(storedCfg), stored: true }
    }
  },
  getConfigSync (): Config {
    const cfgPath = getCfgPath()
    if (!fs.existsSync(cfgPath)) {
      return { stored: false, credentials: [], currentCredential: 0 }
    } else {
      const storedCfg = fs.readFileSync(cfgPath, 'utf8')
      return { ...JSON.parse(storedCfg), stored: true }
    }
  },

  async getConfig (): Promise<Config> {
    const cfgPath = getCfgPath()
    if (!fs.existsSync(cfgPath)) {
      return Promise.resolve({ stored: false, credentials: [], currentCredential: 0 })
    } else {
      const storedCfg = await utils.readFile(cfgPath, 'utf8')
      return { ...JSON.parse(storedCfg), stored: true }
    }
  },

  async storeConfig (cfg: Config): Promise<void> {
    await utils.writeFile(getCfgPath(), JSON.stringify({ ...cfg, stored: undefined }, undefined, 2))
  },

  async storeSfdyConfig (cfg: SfdyConfig): Promise<void> {
    await utils.writeFile(getSfdyCfgPath(), JSON.stringify({ ...cfg, stored: undefined }, undefined, 2))
  },

  async getPackageXmlVersion (): Promise<string> {
    const p = path.join(utils.getWorkspaceFolder(), 'src', 'package.xml')
    const pJson = await utils.parseXmlStrict(await utils.readFile(p))
    return pJson.version
  }
}
