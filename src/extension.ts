'use strict'
import { commands, workspace, languages, window, ExtensionContext } from 'vscode'
import cmds from './commands'
import statusBar from './statusbar'
import configService from './services/config-service'
import { initializeLogger, reporter } from './logger'
import CodeLensRunTest from './codelens-provider/codelens-run-test'
import CodeLensFls from './codelens-provider/codelens-fls'
import packageTreeView from './treeviews-prodiver/package-explorer'
import * as vscode from 'vscode'
import { disposeTestCoverage } from './commands/toggle-test-coverage'
import open = require('open')

const LAST_CHANGELOG_VERSION = 'fastSfdc.lastChangelogVersion'
const CHANGELOG_DISABLED = 'fastSfdc.changelogDisabled'
let changelogPromptedVersion: string | undefined

const showChangelogForNewVersion = async (ctx: ExtensionContext) => {
  const currentVersion = vscode.extensions.getExtension('m1ck83.fast-sfdc')?.packageJSON.version as string | undefined
  if (!currentVersion || changelogPromptedVersion === currentVersion) return
  if (ctx.globalState.get<boolean>(CHANGELOG_DISABLED, false)) return
  if (ctx.globalState.get<string>(LAST_CHANGELOG_VERSION) === currentVersion) return

  changelogPromptedVersion = currentVersion
  const res = await vscode.window.showInformationMessage(
    `Fast-Sfdc updated to version ${currentVersion}. Check out the changelog!`,
    'Show me the news', 'Maybe later', 'Don\'t show again'
  )
  if (!res || res === 'Maybe later') return

  reporter.sendEvent('newVersion', { clicked: res })
  await ctx.globalState.update(LAST_CHANGELOG_VERSION, currentVersion)
  if (res === 'Don\'t show again') {
    await ctx.globalState.update(CHANGELOG_DISABLED, true)
  } else {
    open(`https://github.com/micheletriaca/fast-sfdc/blob/v${currentVersion}/CHANGELOG.md`)
  }
}

const activateExtension = async (ctx: ExtensionContext) => {
  const isOneWorkspaceOpened = workspace.workspaceFolders?.length === 1
  if (isOneWorkspaceOpened) {
    commands.executeCommand('setContext', 'fast-sfdc-active', true)

    const cfg = await configService.getConfig()
    const sfdyConfig = configService.getSfdyConfigSync()
    statusBar.initStatusBar()
    commands.executeCommand('setContext', 'fast-sfdc-configured', cfg.stored && cfg.credentials.length > 0)
    commands.executeCommand('setContext', 'fast-sfdc-source-format', sfdyConfig.sourceFormat?.toLowerCase() === 'sfdx')
    if (configService.consumeCredentialMigrationNotice()) {
      window.showInformationMessage('Fast-Sfdc credentials are now shared securely with the sfdy CLI.')
    }
    await showChangelogForNewVersion(ctx)
  } else {
    statusBar.hideStatusBar()
    commands.executeCommand('setContext', 'fast-sfdc-active', false)
    commands.executeCommand('setContext', 'fast-sfdc-configured', false)
    commands.executeCommand('setContext', 'fast-sfdc-source-format', false)
  }
}

export async function activate (ctx: ExtensionContext) {
  initializeLogger(ctx)
  statusBar.initialize(ctx)
  configService.initialize(ctx.secrets)
  const packageExplorerView = window.createTreeView('packageEditor', {
    treeDataProvider: packageTreeView,
    showCollapseAll: true,
    canSelectMany: true
  })
  packageTreeView.attachTreeView(packageExplorerView)
  ctx.subscriptions.push(...[
    workspace.onDidChangeWorkspaceFolders(() => activateExtension(ctx)),
    workspace.onDidSaveTextDocument(textDocument => cmds.compile(textDocument)),
    commands.registerCommand('FastSfdc.compile', cmds.compile),
    commands.registerCommand('FastSfdc.convertToMetadataFormat', cmds.convertToMetadataFormat),
    commands.registerCommand('FastSfdc.convertToSourceFormat', cmds.convertToSourceFormat),
    commands.registerCommand('FastSfdc.statusBarClick', cmds.statusBarClick),
    commands.registerCommand('FastSfdc.enterCredentials', cmds.credentials),
    commands.registerCommand('FastSfdc.replaceCredentials', cmds.credentials),
    commands.registerCommand('FastSfdc.addCredentials', () => cmds.credentials(true)),
    commands.registerCommand('FastSfdc.manageCredentials', cmds.manageCredentials),
    commands.registerCommand('FastSfdc.removeCredentials', cmds.removeCredentials),
    commands.registerCommand('FastSfdc.createMeta', cmds.createMeta),
    commands.registerCommand('FastSfdc.executeAnonymous', cmds.executeAnonymous),
    commands.registerCommand('FastSfdc.createAuraDefinition', cmds.createAuraDefinition),
    commands.registerCommand('FastSfdc.retrieve', cmds.retrieve),
    commands.registerCommand('FastSfdc.retrieveProfiles', () => cmds.retrieve(['profiles/**/*'])),
    commands.registerCommand('FastSfdc.retrieveSelected', cmds.retrieveSelected),
    commands.registerCommand('FastSfdc.retrieveSelectedMeta', cmds.retrieveSelectedMeta),
    commands.registerCommand('FastSfdc.deploy', cmds.deploy),
    commands.registerCommand('FastSfdc.cancelDeploy', cmds.cancelDeploy),
    commands.registerCommand('FastSfdc.validate', () => cmds.deploy(true)),
    commands.registerCommand('FastSfdc.retrieveSingle', cmds.retrieveSelected),
    commands.registerCommand('FastSfdc.configureStaticResourceBundles', cmds.configureStaticResourceBundles),
    commands.registerCommand('FastSfdc.deploySingle', cmds.deploySelected),
    commands.registerCommand('FastSfdc.deploySelected', cmds.deploySelected),
    commands.registerCommand('FastSfdc.destroySelected', cmds.destroySelected),
    commands.registerCommand('FastSfdc.runTest', cmds.runTest),
    commands.registerCommand('FastSfdc.toggleTestCoverage', cmds.toggleTestCoverage),
    commands.registerCommand('FastSfdc.initSfdy', cmds.initSfdy),
    commands.registerCommand('FastSfdc.editFlsProfiles', cmds.editFlsProfiles),
    commands.registerCommand('FastSfdc.generatePlugin', cmds.generatePlugin),
    languages.registerCodeLensProvider({ language: 'apex', scheme: 'file' }, new CodeLensRunTest()),
    languages.registerCodeLensProvider([
      { pattern: '**/profiles/*.profile' },
      { pattern: '**/profiles/*.profile-meta.xml' },
      { pattern: '**/permissionsets/*.permissionset' },
      { pattern: '**/permissionsets/*.permissionset-meta.xml' }
    ], new CodeLensFls()),
    commands.registerCommand('FastSfdc.refreshPackageTreeview', packageTreeView.refresh),
    commands.registerCommand('FastSfdc.filterPackageTreeview', packageTreeView.filter),
    commands.registerCommand('FastSfdc.showAllPackageTreeview', packageTreeView.filter),
    packageExplorerView,
    { dispose: disposeTestCoverage }
  ])
  await activateExtension(ctx)
}
