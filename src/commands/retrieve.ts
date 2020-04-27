import statusbar from '../statusbar'
import * as vscode from 'vscode'
import configService from '../services/config-service'
import * as sfdyRetrieve from 'sfdy/src/retrieve'
import logger from '../logger'

export default function retrieve (files: string[] = [], filesAreMeta = false) {
  statusbar.startLongJob(async done => {
    const rootFolder = vscode.workspace.rootPath || ''
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
          password: creds.password
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
