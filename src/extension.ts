'use strict'
import { commands, workspace, languages, window, ExtensionContext } from 'vscode'
import cmds from './commands'
import statusBar from './statusbar'
import configService from './services/config-service'
import logger, { reporter } from './logger'
import CodeLensRunTest from './codelens-provider/codelens-run-test'
import CodeLensFls from './codelens-provider/codelens-fls'
import packageTreeView from './treeviews-prodiver/package-explorer'
import * as vscode from 'vscode'
import * as open from 'open'

const activateExtension = async () => {
  const isOneWorkspaceOpened = workspace.workspaceFolders?.length === 1
  if (isOneWorkspaceOpened) {
    statusBar.initStatusBar()
    commands.executeCommand('setContext', 'fast-sfdc-configured', configService.getConfigSync().stored)
    commands.executeCommand('setContext', 'fast-sfdc-active', true)
    logger.appendLine('Extension "fast-sfdc" is now active!')
    reporter.sendEvent('extensionActivated')

    const cfg = await configService.getConfig()
    const currentVersion = vscode.extensions.getExtension('m1ck83.fast-sfdc')?.packageJSON.version
    if (cfg.stored && (!cfg.lastVersion || cfg.lastVersion !== currentVersion)) {
      const res = await vscode.window.showInformationMessage(
        `Fast-Sfdc updated to version ${currentVersion}. Checkout the CHANGELOG!`,
        'Show me the news', 'Maybe later', 'Don\'t show again'
      )
      if (res && res !== 'Maybe later') {
        reporter.sendEvent('newVersion', { clicked: res })
        cfg.lastVersion = currentVersion
        await configService.storeConfig(cfg)
        if (res === 'Show me the news') {
          open(`https://github.com/micheletriaca/fast-sfdc/blob/v${currentVersion}/CHANGELOG.md`)
        }
      }
    }
  } else {
    statusBar.hideStatusBar()
    commands.executeCommand('setContext', 'fast-sfdc-active', false)
    commands.executeCommand('setContext', 'fast-sfdc-configured', false)
  }
}

export function activate (ctx: ExtensionContext) {
  ctx.subscriptions.push(...[
    workspace.onDidChangeWorkspaceFolders(() => activateExtension()),
    workspace.onDidSaveTextDocument(textDocument => cmds.compile(textDocument)),
    commands.registerCommand('FastSfdc.compile', cmds.compile),
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
    commands.registerCommand('FastSfdc.validate', () => cmds.deploy(true)),
    commands.registerCommand('FastSfdc.retrieveSingle', cmds.retrieveSelected),
    commands.registerCommand('FastSfdc.configureStaticResourceBundles', cmds.configureStaticResourceBundles),
    commands.registerCommand('FastSfdc.deploySingle', cmds.deploySelected),
    commands.registerCommand('FastSfdc.deploySelected', cmds.deploySelected),
    commands.registerCommand('FastSfdc.destroySelected', cmds.destroySelected),
    commands.registerCommand('FastSfdc.runTest', cmds.runTest),
    commands.registerCommand('FastSfdc.initSfdy', cmds.initSfdy),
    commands.registerCommand('FastSfdc.editFlsProfiles', cmds.editFlsProfiles),
    languages.registerCodeLensProvider({ language: 'apex', scheme: 'file' }, new CodeLensRunTest()),
    languages.registerCodeLensProvider([{ pattern: '**/profiles/*.profile' }, { pattern: '**/permissionsets/*.permissionset' }], new CodeLensFls()),
    commands.registerCommand('FastSfdc.refreshPackageTreeview', packageTreeView.refresh),
    commands.registerCommand('FastSfdc.filterPackageTreeview', packageTreeView.filter),
    commands.registerCommand('FastSfdc.filterPackageOnlyInOrg', packageTreeView.filterOnlyInOrg),
    window.createTreeView('packageEditor', {
      treeDataProvider: packageTreeView,
      showCollapseAll: true,
      canSelectMany: true
    }),
    reporter
  ])
  activateExtension()
}
