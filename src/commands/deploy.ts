import * as vscode from 'vscode'
import * as sfdyDeploy from 'sfdy/src/deploy'
import * as fs from 'fs'
import * as path from 'path'
import statusbar from '../statusbar'
import configService from '../services/config-service'
import logger from '../logger'

export default function deploy (checkOnly: boolean = false, fileName: string | undefined = undefined) {
  statusbar.startLongJob(async done => {
    const config = configService.getConfigSync()
    const creds = config.credentials[config.currentCredential]
    const sfdyConfigExists = fs.existsSync(path.resolve(vscode.workspace.rootPath || '', '.sfdy.json'))
    const sfdyConfig = sfdyConfigExists ? fs.readFileSync(path.resolve(vscode.workspace.rootPath || '', '.sfdy.json')) : '{}'
    const preDeployPlugins = (sfdyConfig && JSON.parse(sfdyConfig.toString()).preDeployPlugins) || []
    try {
      logger.clear()
      logger.show()
      const deployResult = await sfdyDeploy({
        logger: (msg: string) => logger.appendLine(msg),
        preDeployPlugins,
        basePath: vscode.workspace.rootPath,
        loginOpts: {
          serverUrl: creds.url,
          username: creds.username,
          password: creds.password
        },
        checkOnly,
        files: fileName ? fileName.replace(vscode.workspace.rootPath || '', '') : undefined
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
