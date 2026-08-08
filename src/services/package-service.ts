import { getPackageXml } from 'sfdy/package-utils'
import { buildXml } from 'sfdy/xml-utils'
import { setBasePath } from 'sfdy/path-service'
import configService from './config-service'
import * as SfdcConn from 'sfdy/sfdc-utils'
import * as path from 'upath'
import * as fs from 'fs'
import * as constants from 'sfdy/constants'
import utils from '../utils/utils'
import { resolveSourceLayout } from './source-layout-service'

const getStoredAndDeltaPackage = async (files: string[], sfdcConnector: SfdcConnector, isMeta = false) => {
  const storedPackage = await getPackageXml()
  const deltaPackage = await getPackageXml({ [isMeta ? 'specificMeta' : 'specificFiles']: files, sfdcConnector })
  return { deltaPackage, storedPackage }
}

export default {
  async getSfdcConnector (): Promise<SfdcConnector> {
    const workspaceRoot = utils.getWorkspaceFolder()
    setBasePath(workspaceRoot)
    const sfdyConfig = configService.getSfdyConfigSync()
    const layout = resolveSourceLayout(workspaceRoot, sfdyConfig)
    const cfg = configService.getConfigSync()
    const loginOpts = cfg.credentials[cfg.currentCredential]
    const apiVersion = layout.apiVersion || (await getPackageXml()).version[0]
    const sfdcConnector = await SfdcConn.newInstance({
      username: loginOpts.username || '',
      password: loginOpts.password || '',
      serverUrl: loginOpts.url,
      oauth2: loginOpts.type === 'oauth2' ? {
        instanceUrl: loginOpts.instanceUrl,
        refreshToken: loginOpts.password,
        clientId: constants.DEFAULT_CLIENT_ID
      } : undefined,
      apiVersion
    })
    return sfdcConnector
  },
  async addToPackage (files: string[], sfdcConnector: SfdcConnector, isMeta = false) {
    if (files.length === 0) return
    if (resolveSourceLayout(utils.getWorkspaceFolder(), configService.getSfdyConfigSync()).isSourceFormat) return
    const { storedPackage, deltaPackage } = await getStoredAndDeltaPackage(files, sfdcConnector, isMeta)
    const stTypeMap = new Map((storedPackage.types || []).map(x => [x.name[0], x.members]))
    for (const t of (deltaPackage.types || [])) {
      const members = new Set([...stTypeMap.get(t.name[0]) || [], ...t.members])
      stTypeMap.set(t.name[0], members.has('*') ? ['*'] : [...members].sort())
    }
    this.storePackage({
      ...storedPackage,
      types: [...stTypeMap]
        .map(([name, members]) => ({ members, name: [name] }))
        .sort((a, b) => a.name[0] > b.name[0] ? 1 : -1)
    })
  },
  async addMetaToPackage (meta: string[]) {
    this.addToPackage(meta, await this.getSfdcConnector(), true)
  },
  async removeFromPackage (files: string[], sfdcConnector: SfdcConnector, isMeta = false) {
    if (files.length === 0) return
    if (resolveSourceLayout(utils.getWorkspaceFolder(), configService.getSfdyConfigSync()).isSourceFormat) return
    const { storedPackage, deltaPackage } = await getStoredAndDeltaPackage(files, sfdcConnector, isMeta)
    const itemsToRemove = new Set(deltaPackage.types.flatMap(t => t.members.map(m => `${t.name[0]}/${m}`)))
    this.storePackage({
      ...storedPackage,
      types: storedPackage.types
        .map(t => ({ ...t, members: t.members.filter(m => !itemsToRemove.has(`${t.name[0]}/${m}`)) }))
        .filter(t => !!t.members.length)
        .sort((a, b) => a.name[0] > b.name[0] ? 1 : -1)
    })
  },
  async removeMetaFromPackage (meta: string[]) {
    this.removeFromPackage(meta, await this.getSfdcConnector(), true)
  },
  storePackage (pkg: Package) {
    const layout = resolveSourceLayout(utils.getWorkspaceFolder(), configService.getSfdyConfigSync())
    if (layout.isSourceFormat) return
    const packagePath = path.resolve(layout.root, 'package.xml')
    fs.writeFileSync(packagePath, buildXml({ Package: pkg }) + '\n')
  }
}
