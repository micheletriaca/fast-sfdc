import { Config } from '../fast-sfdc'
import * as path from 'path'
import * as fs from 'fs'
import * as vscode from 'vscode'
import utils from '../utils/utils'

const getCfgPath = () => path.join(vscode.workspace.rootPath as string, 'fastsfdc.json')
const CURRENT_API_VERSION = '45.0'

export default {
  getConfigSync (): Config {
    const cfgPath = getCfgPath()
    if (!vscode.workspace.rootPath || !fs.existsSync(cfgPath)) {
      return { stored: false, apiVersion: CURRENT_API_VERSION, credentials: [], currentCredential: 0 }
    } else {
      const storedCfg = fs.readFileSync(cfgPath, 'utf8')
      return { ...JSON.parse(storedCfg), stored: true }
    }
  },

  async getConfig (): Promise<Config> {
    const cfgPath = getCfgPath()
    if (!vscode.workspace.rootPath || !fs.existsSync(cfgPath)) {
      return Promise.resolve({ stored: false, apiVersion: CURRENT_API_VERSION, credentials: [], currentCredential: 0 })
    } else {
      const storedCfg = await utils.readFile(cfgPath, 'utf8')
      return { ...JSON.parse(storedCfg), stored: true }
    }
  },

  async storeConfig (cfg: Config): Promise<void> {
    if (!vscode.workspace.rootPath) throw Error('You must be in a workspace to store the configuration')
    await utils.writeFile(getCfgPath(), JSON.stringify({ ...cfg, stored: undefined }, undefined, 2))
  }
}
