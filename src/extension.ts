'use strict'
import * as vscode from 'vscode'
import cmds from './commands'
import statusBar from './statusbar'
import configService from './services/config-service'

export function activate (ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument(textDocument => cmds.compile(textDocument)))
  ctx.subscriptions.push(vscode.commands.registerCommand('FastSfdc.enterCredentials', cmds.credentials))
  ctx.subscriptions.push(vscode.commands.registerCommand('FastSfdc.replaceCredentials', cmds.credentials))
  ctx.subscriptions.push(vscode.commands.registerCommand('FastSfdc.addCredentials', () => cmds.credentials(true)))
  ctx.subscriptions.push(vscode.commands.registerCommand('FastSfdc.changeCredentials', cmds.changeCredentials))
  ctx.subscriptions.push(vscode.commands.registerCommand('FastSfdc.createMeta', cmds.createMeta))
  ctx.subscriptions.push(vscode.commands.registerCommand('FastSfdc.executeAnonymous', cmds.executeAnonymous))
  ctx.subscriptions.push(vscode.commands.registerCommand('FastSfdc.createAuraDefinition', cmds.createAuraDefinition))
  ctx.subscriptions.push(vscode.commands.registerCommand('FastSfdc.retrieve', cmds.retrieve))
  ctx.subscriptions.push(vscode.commands.registerCommand('FastSfdc.deploy', cmds.deploy))
  ctx.subscriptions.push(vscode.commands.registerCommand('FastSfdc.validate', () => cmds.deploy(true)))
  statusBar.initStatusBar()
  vscode.commands.executeCommand('setContext', 'fast-sfdc-active', true)
  const cfg = configService.getConfigSync()
  vscode.commands.executeCommand('setContext', 'fast-sfdc-configured', cfg.stored)
  vscode.commands.executeCommand('setContext', 'fast-sfdc-more-credentials', cfg.credentials.length > 1)
  console.log('Extension "fast-sfdc" is now active!')
}
