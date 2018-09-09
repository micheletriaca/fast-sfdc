import { Config } from './fast-sfdc'
import * as path from 'path'
import * as fs from 'fs'
import * as vscode from 'vscode'

const getCfgPath = () => path.join(vscode.workspace.rootPath as string, 'fastsfdc.json')
const CURRENT_API_VERSION = '43.0'

export default {
  getConfig (): Promise<Config> {
    return new Promise((resolve, reject) => {
      const cfgPath = getCfgPath()
      if (!vscode.workspace.rootPath || !fs.existsSync(cfgPath)) {
        resolve({ stored: false, apiVersion: CURRENT_API_VERSION })
      } else {
        fs.readFile(cfgPath, 'utf8', (err, res) => err && reject(err) || resolve({ ...JSON.parse(res), stored: true }))
      }
    })
  },

  storeConfig (cfg: Config): Promise<void> {
    return new Promise((resolve) => {
      if (!vscode.workspace.rootPath) throw Error('You must be in a workspace to store the configuration')
      fs.writeFile(getCfgPath(), JSON.stringify({ ...cfg, stored: undefined }, undefined, 2), () => resolve())
    })
  }
}
