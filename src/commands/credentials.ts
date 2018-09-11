import * as vscode from 'vscode'
import configService from '../config-service'
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
      label: 'Production / Developer',
      description: 'login.salesforce.com'
    }, {
      label: 'Sandbox / Test',
      description: 'test.salesforce.com'
    }
  ], { ignoreFocusOut: true })
  return res && res.description || ''
}

export default async function enterCredentials () {
  const config = await configService.getConfig()

  config.url = await getUrl()
  if (!config.url) return

  config.username = await getUsername(config)
  if (!config.username) return

  config.password = await getPassword(config)
  if (!config.password) return

  await configService.storeConfig(config)

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
