import * as vscode from 'vscode'
import configService from '../services/config-service'
import connector from '../sfdc-connector'
import StatusBar from '../statusbar'
import utils from '../utils/utils'
import { ConfigCredential } from '../fast-sfdc'

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

export default async function enterCredentials (addMode: Boolean = false) {
  const config = await configService.getConfig()

  const creds: ConfigCredential = {}

  creds.url = await getUrl()
  if (!creds.url) return

  creds.username = await utils.inputText('Please enter your SFDC username', creds.username)
  if (!creds.username) return

  creds.password = await utils.inputText('Please enter your SFDC password and token', creds.password, { password: true })
  if (!creds.password) return

  if (addMode) {
    config.credentials.push(creds)
    config.currentCredential = config.credentials.length - 1
  } else {
    config.credentials[config.currentCredential] = creds
  }

  await configService.storeConfig(config)
  vscode.commands.executeCommand('setContext', 'fast-sfdc-configured', true)
  vscode.commands.executeCommand('setContext', 'fast-sfdc-more-credentials', config.credentials.length > 1)

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
