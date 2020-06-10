import * as sfdyDeploy from 'sfdy/src/deploy'
import * as fs from 'fs'
import * as path from 'upath'
import * as deleteEmpty from 'delete-empty'
import statusbar from '../statusbar'
import configService from '../services/config-service'
import logger from '../logger'
import packageService from '../services/package-service'
import { getListOfSrcFiles, getPackageMapping } from 'sfdy/src/utils/package-utils'
import utils from '../utils/utils'

export default function deploy (checkOnly = false, destructive = false, files: string[] = []) {
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
      const deployResult = await sfdyDeploy({
        logger: (msg: string) => logger.appendLine(msg),
        preDeployPlugins: sfdyConfig.preDeployPlugins,
        renderers: sfdyConfig.renderers,
        basePath: rootFolder,
        destructive,
        loginOpts: {
          serverUrl: creds.url,
          username: creds.username,
          password: creds.password
        },
        checkOnly,
        config: sfdyConfig,
        files: sanitizedFiles
      })
      const isDeployOk = deployResult.status === 'Succeeded'
      if (isDeployOk && !checkOnly && destructive) {
        const sfdcConnector = await packageService.getSfdcConnector()
        await packageService.removeFromPackage(files, sfdcConnector)
        const packageMapping = await getPackageMapping(sfdcConnector)
        const listOfSrcFilesToDelete = await getListOfSrcFiles(packageMapping, files)
        listOfSrcFilesToDelete.forEach(f => {
          fs.unlinkSync(path.resolve(utils.getWorkspaceFolder(), 'src', f))
        })
        await deleteEmpty(path.resolve(utils.getWorkspaceFolder(), 'src'))
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
