import { getPackageXml } from 'sfdy/src/utils/package-utils'
import { buildXml } from 'sfdy/src/utils/xml-utils'
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
