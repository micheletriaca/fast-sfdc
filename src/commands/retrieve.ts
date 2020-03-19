import statusbar from '../statusbar'
import * as path from 'path'
import * as vscode from 'vscode'
import configService from '../services/config-service'
import * as fs from 'fs'
import * as sfdyRetrieve from 'sfdy/src/retrieve'
import logger from '../logger'

export default function retrieve (profileOnly = false, fileName: string | undefined = undefined) {
  statusbar.startLongJob(async done => {
    const config = configService.getConfigSync()
    const creds = config.credentials[config.currentCredential]
    const sfdyConfigExists = fs.existsSync(path.resolve(vscode.workspace.rootPath || '', '.sfdy.json'))
    const sfdyConfig = sfdyConfigExists ? JSON.parse(fs.readFileSync(path.resolve(vscode.workspace.rootPath || '', '.sfdy.json')).toString()) : {}
    const files = [
      profileOnly ? 'profiles/**/*' : '',
      fileName ? fileName.replace(vscode.workspace.rootPath || '', '') : undefined
    ].filter(x => x).join(',')

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
        files,
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
