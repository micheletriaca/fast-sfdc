import { getPackageXml } from 'sfdy/src/utils/package-utils'
import { buildXml } from 'sfdy/src/utils/xml-utils'
import { setBasePath } from 'sfdy/src/services/path-service'
import configService from './config-service'
import * as SfdcConn from 'sfdy/src/utils/sfdc-utils'
import * as path from 'path'
import * as vscode from 'vscode'
import * as fs from 'fs'

const getStoredAndDeltaPackage = async (files: string[], sfdcConnector: SfdcConnector) => {
  const storedPackage = await getPackageXml()
  return {
    deltaPackage: await getPackageXml({ specificFiles: files, sfdcConnector }),
    storedPackage
  }
}

export default {
  async getSfdcConnector (): Promise<SfdcConnector> {
    setBasePath(vscode.workspace.rootPath || '')
    const cfg = configService.getConfigSync()
    const loginOpts = cfg.credentials[cfg.currentCredential]
    const storedPackage = await getPackageXml()
    const sfdcConnector = await SfdcConn.newInstance({
      username: loginOpts.username || '',
      password: loginOpts.password || '',
      serverUrl: loginOpts.url,
      apiVersion: storedPackage.version[0]
    })
    return sfdcConnector
  },
  async addToPackage (files: string[], sfdcConnector: SfdcConnector) {
    const { storedPackage, deltaPackage } = await getStoredAndDeltaPackage(files, sfdcConnector)
    storedPackage.types = storedPackage.types.map(t => {
      if (t.members.find(m => m === '*')) return t
      const dt = deltaPackage.types.find(dt => dt.name[0] === t.name[0])
      if (!dt) return t
      dt.members
        .filter(dm => t.members.indexOf(dm) === -1)
        .forEach(dm => t.members.push(dm))
      t.members.sort()
      return t
    })
    const packagePath = path.resolve(vscode.workspace.rootPath || '', 'src', 'package.xml')
    fs.writeFileSync(packagePath, buildXml({ Package: storedPackage }) + '\n')
  },
  async removeFromPackage (files: string[], sfdcConnector: SfdcConnector) {
    const { storedPackage, deltaPackage } = await getStoredAndDeltaPackage(files, sfdcConnector)
    const itemsToRemove = new Set(deltaPackage.types.flatMap(t => t.members.map(m => `${t.name[0]}/${m}`)))
    storedPackage.types = storedPackage.types
      .map(t => ({ ...t, members: t.members.filter(m => !itemsToRemove.has(`${t.name[0]}/${m}`)) }))
      .filter(t => !!t.members.length)
    const packagePath = path.resolve(vscode.workspace.rootPath || '', 'src', 'package.xml')
    fs.writeFileSync(packagePath, buildXml({ Package: storedPackage }) + '\n')
  }
}
