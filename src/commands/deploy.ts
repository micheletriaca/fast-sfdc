import * as vscode from 'vscode'
import * as sfdyDeploy from 'sfdy/src/deploy'
import * as fs from 'fs'
import * as path from 'path'
import * as deleteEmpty from 'delete-empty'
import statusbar from '../statusbar'
import configService from '../services/config-service'
import logger from '../logger'
import packageService from '../services/package-service'
import { getListOfSrcFiles, getPackageMapping } from 'sfdy/src/utils/package-utils'

export default function deploy (checkOnly = false, destructive = false, files: string[] = []) {
  statusbar.startLongJob(async done => {
    const rootFolder = vscode.workspace.rootPath || ''
    const config = configService.getConfigSync()
    const creds = config.credentials[config.currentCredential]
    process.env.environment = creds.environment
    const { preDeployPlugins = [], renderers = [] } = configService.getSfdyConfigSync()
    const sanitizedFiles = files.map(x => x.replace(rootFolder, '')).join(',')

    try {
      logger.clear()
      logger.show()
      const deployResult = await sfdyDeploy({
        logger: (msg: string) => logger.appendLine(msg),
        preDeployPlugins,
        renderers,
        basePath: rootFolder,
        destructive,
        loginOpts: {
          serverUrl: creds.url,
          username: creds.username,
          password: creds.password
        },
        checkOnly,
        files: sanitizedFiles
      })
      const isDeployOk = deployResult.status === 'Succeeded'
      if (isDeployOk && !checkOnly && destructive) {
        const sfdcConnector = await packageService.getSfdcConnector()
        await packageService.removeFromPackage(files, sfdcConnector)
        const packageMapping = await getPackageMapping(sfdcConnector)
        const listOfSrcFilesToDelete = await getListOfSrcFiles(packageMapping, files)
        listOfSrcFilesToDelete.forEach(f => {
          fs.unlinkSync(path.resolve(vscode.workspace.rootPath || '', 'src', f))
        })
        await deleteEmpty(path.resolve(vscode.workspace.rootPath || '', 'src'))
      }
      done(isDeployOk ? '👍🏻' : '👎🏻')
    } catch (e) {
      logger.appendLine('Something went wrong')
      logger.appendLine(e.message)
      logger.show()
      done('👎🏻')
    }
  })
}
