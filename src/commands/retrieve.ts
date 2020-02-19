import statusbar from '../statusbar'
import * as path from 'path'
import * as vscode from 'vscode'
import configService from '../services/config-service'
import * as fs from 'fs'
import * as sfdyRetrieve from 'sfdy/src/retrieve'
import logger from '../logger'

export default async function retrieve () {
  statusbar.startLongJob(async done => {
    const config = configService.getConfigSync()
    const creds = config.credentials[config.currentCredential]
    const sfdyConfig = fs.readFileSync(path.resolve(vscode.workspace.rootPath || '', '.sfdy.json'))
    try {
      logger.clear()
      logger.show()
      await sfdyRetrieve({
        logger: (msg: string) => logger.appendLine(msg),
        basePath: vscode.workspace.rootPath,
        loginOpts: {
          serverUrl: creds.url,
          username: creds.username,
          password: creds.password
        },
        config: (sfdyConfig && JSON.parse(sfdyConfig.toString('utf8'))) || {}
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
