import * as vscode from 'vscode'
import statusbar from '../statusbar'
import configService from '../services/config-service'
import logger from '../logger'
import packageService from '../services/package-service'
import utils from '../utils/utils'
import sfdyConvert = require('sfdy/convert')

type TargetFormat = 'metadata' | 'sfdx'

const formatLabel = (format: TargetFormat) => format === 'sfdx'
  ? 'Salesforce DX source format'
  : 'Metadata API format'

export default async function convertSourceFormat (targetFormat: TargetFormat) {
  const selected = await vscode.window.showWarningMessage(
    `Convert all project metadata to ${formatLabel(targetFormat)}? Project files and .sfdy.json will be rewritten.`,
    { modal: true },
    'Convert'
  )
  if (selected !== 'Convert') return

  statusbar.startLongJob(async done => {
    try {
      const rootFolder = utils.getWorkspaceFolder()
      const config = configService.getConfigSync()
      const creds = config.credentials[config.currentCredential]
      const sfdyConfig = configService.getSfdyConfigSync()
      process.env.environment = creds.environment
      logger.clear()
      logger.show()
      const sfdcConnector = await packageService.getSfdcConnector()
      const result = await sfdyConvert({
        basePath: rootFolder,
        config: sfdyConfig,
        logger: (message: string) => logger.appendLine(message),
        sfdcConnector,
        targetFormat
      })
      await vscode.commands.executeCommand('setContext', 'fast-sfdc-source-format', result.sourceFormat === 'sfdx')
      await vscode.commands.executeCommand('FastSfdc.refreshPackageTreeview')
      vscode.window.showInformationMessage(`Project converted to ${formatLabel(targetFormat)}.`)
      done('👍🏻')
    } catch (error) {
      logger.appendLine('Something went wrong')
      logger.appendLine(error.message)
      logger.show()
      vscode.window.showErrorMessage(`Unable to convert the project: ${error.message}`)
      done('👎🏻')
    }
  })
}
