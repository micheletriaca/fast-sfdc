import { setBasePath } from 'sfdy/path-service'
import configService from './config-service'
import * as SfdcConn from 'sfdy/sfdc-utils'
import utils from '../utils/utils'
import { resolveSourceLayout } from './source-layout-service'

export default {
  async getSfdcConnector (): Promise<SfdcConnector> {
    const workspaceRoot = utils.getWorkspaceFolder()
    setBasePath(workspaceRoot)
    const sfdyConfig = configService.getSfdyConfigSync()
    const layout = resolveSourceLayout(workspaceRoot, sfdyConfig)
    const cfg = configService.getConfigSync()
    const credential = cfg.credentials[cfg.currentCredential]
    const loginOpts = configService.getLoginOptions(credential)
    const apiVersion = layout.apiVersion
    if (!apiVersion) throw Error('Missing API version. Set apiVersion in .sfdy.json')
    const sfdcConnector = await SfdcConn.newInstance({
      username: loginOpts.username || '',
      password: loginOpts.password || '',
      serverUrl: loginOpts.serverUrl,
      oauth2: credential.type === 'oauth2' ? loginOpts : undefined,
      apiVersion
    })
    return sfdcConnector
  }
}
