import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { Config } from '../fast-sfdc'
import connector from '../sfdc-connector'
import StatusBar from '../statusbar'

async function getUsername (config: Config): Promise<string> {
  const result = await vscode.window.showInputBox({
    ignoreFocusOut: true,
    placeHolder: 'mark@salesforce.com',
    value: config.username || '',
    prompt: 'Please enter your SFDC username'
  })
  return result || ''
}

async function getPassword (config: Config): Promise<string> {
  const result = await vscode.window.showInputBox({
    ignoreFocusOut: true,
    password: true,
    value: config.password || '',
    placeHolder: 'enter your password and token',
    prompt: 'Please enter your SFDC password and token'
  })
  return result || ''
}

async function getUrl (): Promise<string> {
  const res = await vscode.window.showQuickPick([
    {
      label: '$(code) Production / Developer',
      description: 'login.salesforce.com'
    }, {
      label: '$(beaker) Sandbox / Test',
      description: 'test.salesforce.com'
    }
  ], { ignoreFocusOut: true })
  return res && res.description || ''
}

export default async function enterCredentials () {
  const config: Config = { apiVersion: '43.0' }

  config.url = await getUrl()
  if (!config.url) return

  config.username = await getUsername(config)
  if (!config.username) return

  config.password = await getPassword(config)
  if (!config.password) return

  fs.writeFileSync(
    path.join(vscode.workspace.rootPath as string, 'fastsfdc.json'),
    JSON.stringify(config, undefined, 2)
  )

  try {
    StatusBar.startLoading()
    await connector.connect(config)
    StatusBar.stopLoading()
    vscode.window.showInformationMessage('Credentials ok!')
  } catch (error) {
    StatusBar.stopLoading()
    vscode.window.showErrorMessage('Wrong credentials. Fix them to retry')
  }
}
