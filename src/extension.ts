'use strict'
import * as vscode from 'vscode'
import commands from './commands'
import statusBar from './statusbar'

export function activate (context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(textDocument => commands.compile(textDocument)))
  context.subscriptions.push(vscode.commands.registerCommand('FastSfdc.enterCredentials', commands.credentials))
  statusBar.initStatusBar()
  console.log('Extension "fast-sfdc" is now active!')
}
