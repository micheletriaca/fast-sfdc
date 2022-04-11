import * as vscode from 'vscode'
import statusbar from '../statusbar'
import configService from '../services/config-service'
import * as sfdyRetrieve from 'sfdy/src/retrieve'
import logger from '../logger'
import utils from '../utils/utils'
import { getPackageXml } from 'sfdy/src/utils/package-utils'
import { setBasePath } from 'sfdy/src/services/path-service'

const ALL_METAS = 'All metadata'
const PARTIAL_METAS = 'Partial selection'
async function getRetrieveMode (): Promise<string> {
  const res = await vscode.window.showQuickPick([
    {
      label: 'All metadata',
      description: ALL_METAS
    }, {
      label: 'Choose metadata',
      description: PARTIAL_METAS
    }
  ], { ignoreFocusOut: true })
  return (res && res.description) || ''
}

async function getChosenMetadata (): Promise<Array<string>> {
  setBasePath(utils.getWorkspaceFolder())
  const storedPackage = await getPackageXml()
  const res = await vscode.window.showQuickPick(
    [...storedPackage.types.map(
      t => {
        return {
          label: t.name[0]
        }
      })
    ],
    {
      ignoreFocusOut: true,
      canPickMany: true
    })
  return (res && res.map(r => r.label)) || ['']
}

export default async function retrieve (files: string[] = [], filesAreMeta = false) {
  if (files.length === 0) {
    const mode = await getRetrieveMode()
    files = mode === PARTIAL_METAS ? (await getChosenMetadata()).map(m => m + '/*') : []
    filesAreMeta = files.length > 0
  }
  statusbar.startLongJob(async done => {
    const rootFolder = utils.getWorkspaceFolder()
    const config = configService.getConfigSync()
    const creds = config.credentials[config.currentCredential]
    process.env.environment = creds.environment
    const sfdyConfig = configService.getSfdyConfigSync()
    const sanitizedFiles = files.map(x => x.replace(rootFolder, '')).join(',')
    try {
      logger.clear()
      logger.show()
      await sfdyRetrieve({
        logger: (msg: string) => logger.appendLine(msg),
        basePath: rootFolder,
        loginOpts: {
          serverUrl: creds.url,
          username: creds.username,
          password: creds.password,
          instanceUrl: creds.type === 'oauth2' ? creds.instanceUrl : undefined,
          refreshToken: creds.type === 'oauth2' ? creds.password : undefined
        },
        [filesAreMeta ? 'meta' : 'files']: sanitizedFiles,
        config: sfdyConfig
      })
      done('👍🏻')
    } catch (e) {
      logger.appendLine('Something went wrong')
      logger.appendLine(e.message)
      logger.show()
      done('👎🏻')
    }
  })
}
