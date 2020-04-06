import statusbar from '../statusbar'
import * as path from 'path'
import * as vscode from 'vscode'
import configService from '../services/config-service'
import * as fs from 'fs'
import * as sfdyRetrieve from 'sfdy/src/retrieve'
import logger from '../logger'

export default function retrieve (files: string[] = []) {
  statusbar.startLongJob(async done => {
    const rootFolder = vscode.workspace.rootPath || ''
    const config = configService.getConfigSync()
    const creds = config.credentials[config.currentCredential]
    process.env.environment = creds.environment
    const sfdyConfigExists = fs.existsSync(path.resolve(rootFolder, '.sfdy.json'))
    const sfdyConfig = sfdyConfigExists ? JSON.parse(fs.readFileSync(path.resolve(rootFolder, '.sfdy.json')).toString()) : {}
    const sanitizedFiles = files.map(x => x.replace(rootFolder, '')).join(',')

    try {
      logger.clear()
      logger.show()
      if (sanitizedFiles) logger.appendLine('Requested files: ' + sanitizedFiles)
      await sfdyRetrieve({
        logger: (msg: string) => logger.appendLine(msg),
        basePath: rootFolder,
        loginOpts: {
          serverUrl: creds.url,
          username: creds.username,
          password: creds.password
        },
        files: sanitizedFiles,
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
