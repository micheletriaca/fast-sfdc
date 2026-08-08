import * as fs from 'fs'
import * as path from 'upath'
import statusbar from '../statusbar'
import configService from '../services/config-service'
import logger from '../logger'
import packageService from '../services/package-service'
import { expandDirectoryPatterns, getListOfSrcFiles, getPackageMapping } from 'sfdy/package-utils'
import { getAdapter } from 'sfdy/format-adapters'
import utils from '../utils/utils'
import { resolveSourceLayout } from '../services/source-layout-service'
import sfdyDeploy = require('sfdy/deploy')
import deleteEmpty = require('delete-empty')
import globby = require('globby')

export default function deploy (checkOnly = false, destructive = false, files: string[] = []) {
  statusbar.startLongJob(async done => {
    const rootFolder = utils.getWorkspaceFolder()
    const config = configService.getConfigSync()
    const creds = config.credentials[config.currentCredential]
    process.env.environment = creds.environment
    const sfdyConfig = configService.getSfdyConfigSync()
    const layout = resolveSourceLayout(rootFolder, sfdyConfig)
    const sourceFiles = files.map(layout.toRelativePath)
    const sanitizedFiles = sourceFiles.join(',')

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
          password: creds.password,
          instanceUrl: creds.type === 'oauth2' ? creds.instanceUrl : undefined,
          refreshToken: creds.type === 'oauth2' ? creds.password : undefined
        },
        checkOnly,
        config: sfdyConfig,
        files: sanitizedFiles.length > 0 ? sanitizedFiles : undefined
      })
      const isDeployOk = deployResult.status === 'Succeeded'
      if (isDeployOk && !checkOnly && destructive) {
        const sfdcConnector = await packageService.getSfdcConnector()
        const packageMapping = await getPackageMapping(sfdcConnector)
        let listOfSrcFilesToDelete: string[]
        if (layout.isSourceFormat) {
          const adapter = getAdapter(sfdyConfig, undefined, packageMapping)
          if (!adapter) throw Error('Unable to initialize the source-format adapter')
          const selectedFiles = await globby(expandDirectoryPatterns(sourceFiles, layout.root), { cwd: layout.root })
          const availableFiles = await globby(['**/*'], { cwd: layout.root })
          listOfSrcFilesToDelete = adapter.getDestructivePaths(selectedFiles, availableFiles)
        } else {
          listOfSrcFilesToDelete = await getListOfSrcFiles(packageMapping, sourceFiles)
        }
        listOfSrcFilesToDelete.forEach(f => {
          const target = path.resolve(layout.root, f)
          const relativeTarget = path.relative(layout.root, target)
          if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
            throw Error(`Refusing to delete a path outside the source folder: ${f}`)
          }
          fs.rmSync(target, { recursive: true, force: true })
        })
        await deleteEmpty(layout.root)
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
