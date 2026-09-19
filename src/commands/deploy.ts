import * as fs from 'fs'
import * as vscode from 'vscode'
import * as path from 'path'
import statusbar from '../statusbar'
import configService from '../services/config-service'
import logger from '../logger'
import packageService from '../services/package-service'
import { expandDirectoryPatterns, getListOfSrcFiles, getPackageMapping } from 'sfdy/package-utils'
import { getAdapter } from 'sfdy/format-adapters'
import utils from '../utils/utils'
import { resolveSourceLayout } from '../services/source-layout-service'
import { confirmProductionMutation, ensureOrgWritable, getOrganizationKind } from '../services/org-protection-service'
import { chooseProductionDeployTests, DeploymentTestSelection } from '../services/deploy-test-service'
import sfdyDeploy = require('sfdy/deploy')
import deleteEmpty = require('delete-empty')
import globby = require('globby')

const chooseProductionDeployMode = async (destructive: boolean): Promise<boolean | undefined> => {
  const selected = await vscode.window.showQuickPick([{
    label: '$(shield) Validate only',
    description: destructive
      ? 'Validate the destructive changes without deleting metadata'
      : 'Run a check-only deployment without changing the org',
    checkOnly: true
  }, {
    label: destructive ? '$(trash) Deploy destructive changes now' : '$(cloud-upload) Deploy now',
    description: 'Apply the changes to the production org',
    checkOnly: false
  }], {
    ignoreFocusOut: true,
    title: 'Choose how to proceed with the production deployment',
    placeHolder: 'Validate first or deploy immediately'
  })
  return selected?.checkOnly
}

export default async function deploy (checkOnly = false, destructive = false, files: string[] = []) {
  let operation = checkOnly
    ? 'validate metadata'
    : destructive
      ? 'destructively deploy metadata'
      : 'deploy metadata'
  const config = await configService.getConfig()
  if (!await ensureOrgWritable(operation, { config })) return

  let testSelection: DeploymentTestSelection = { proceed: true, testRequired: false }
  const organizationKind = await getOrganizationKind(config)
  if (organizationKind === 'production' || organizationKind === 'unknown') {
    if (!checkOnly) {
      const selectedCheckOnly = await chooseProductionDeployMode(destructive)
      if (selectedCheckOnly === undefined) return
      checkOnly = selectedCheckOnly
      operation = checkOnly
        ? destructive ? 'validate destructive metadata changes' : 'validate metadata'
        : destructive ? 'destructively deploy metadata' : 'deploy metadata'
    }
    testSelection = await chooseProductionDeployTests()
    if (!testSelection.proceed) return
  }

  const testDetail = testSelection.testLevel
    ? `Apex test level: ${testSelection.testLevel}${testSelection.specifiedTests ? ` (${testSelection.specifiedTests})` : ''}.`
    : undefined
  if (!await confirmProductionMutation(operation, config, testDetail)) return

  statusbar.startLongJob(async done => {
    const rootFolder = utils.getWorkspaceFolder()
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
          refreshToken: creds.type === 'oauth2' ? creds.password : undefined,
          clientId: creds.clientId,
          clientSecret: creds.clientSecret
        },
        checkOnly,
        testLevel: testSelection.testLevel,
        specifiedTests: testSelection.specifiedTests,
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
