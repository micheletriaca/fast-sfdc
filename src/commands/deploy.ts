import * as vscode from 'vscode'
import * as sfdyDeploy from 'sfdy/src/deploy'
import * as fs from 'fs'
import * as path from 'path'
import statusbar from '../statusbar'
import configService from '../services/config-service'
import logger from '../logger'

export default function deploy (checkOnly = false, files: string[] = []) {
  statusbar.startLongJob(async done => {
    const rootFolder = vscode.workspace.rootPath || ''
    const config = configService.getConfigSync()
    const creds = config.credentials[config.currentCredential]
    process.env.environment = creds.environment
    const sfdyConfigExists = fs.existsSync(path.resolve(rootFolder, '.sfdy.json'))
    const sfdyConfig = sfdyConfigExists ? JSON.parse(fs.readFileSync(path.resolve(rootFolder, '.sfdy.json')).toString()) : {}
    const preDeployPlugins = sfdyConfig.preDeployPlugins || []
    const renderers = sfdyConfig.renderers || []
    const sanitizedFiles = files.map(x => x.replace(rootFolder, '')).join(',')

    try {
      logger.clear()
      logger.show()
      const deployResult = await sfdyDeploy({
        logger: (msg: string) => logger.appendLine(msg),
        preDeployPlugins,
        renderers,
        basePath: rootFolder,
        loginOpts: {
          serverUrl: creds.url,
          username: creds.username,
          password: creds.password
        },
        checkOnly,
        files: sanitizedFiles
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
