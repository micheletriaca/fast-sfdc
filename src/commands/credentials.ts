import * as vscode from 'vscode'
import configService from '../services/config-service'
import connector from '../sfdc-connector'
import StatusBar from '../statusbar'
import utils from '../utils/utils'

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

  config.username = await utils.inputText('Please enter your SFDC username', config.username)
  if (!config.username) return

  config.password = await utils.inputText('Please enter your SFDC password and token', config.password, { password: true })
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
