import * as vscode from 'vscode'
import * as sfdyDeploy from 'sfdy/src/deploy'
import statusbar from '../statusbar'
import configService from '../services/config-service'
import logger from '../logger'

export default function deploy (checkOnly: boolean = false) {
  statusbar.startLongJob(async done => {
    const config = configService.getConfigSync()
    const creds = config.credentials[config.currentCredential]
    try {
      logger.clear()
      logger.show()
      const deployResult = await sfdyDeploy({
        logger: (msg: string) => logger.appendLine(msg),
        basePath: vscode.workspace.rootPath,
        loginOpts: {
          serverUrl: creds.url,
          username: creds.username,
          password: creds.password
        },
        checkOnly
      })
      done(deployResult.status === 'Succeeded' ? '👍🏻' : '👎🏻')
    } catch (e) {
      logger.appendLine('Something went wrong')
      logger.appendLine(e.message)
      logger.show()
      done('👎🏻')
    }
  })
}
