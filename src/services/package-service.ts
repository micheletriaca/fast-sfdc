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
    const stTypes = storedPackage.types || []
    for (let i = 0; i < (deltaPackage.types || []).length; i++) {
      const t = deltaPackage.types[i]
      const stType = stTypes.find(st => st.name[0] === t.name[0]) || stTypes[stTypes.push({ members: [], name: [t.name[0]] }) - 1]
      if (!stType.members.find(m => m === '*')) {
        for (let j = 0; j < t.members.length; j++) {
          const dm = t.members[j]
          if (!stType.members.find(m => m === dm)) {
            stType.members.push(dm)
          }
        }
        stType.members.sort()
      }
    }
    stTypes.sort((a, b) => a.name[0] > b.name[0] ? 1 : -1)
    storedPackage.types = stTypes
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
