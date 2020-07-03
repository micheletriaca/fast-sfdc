import * as vscode from 'vscode'
import configService from '../services/config-service'
import connector from '../sfdc-connector'
import StatusBar from '../statusbar'
import utils from '../utils/utils'
import { ConfigCredential } from '../fast-sfdc'
import toolingService from '../services/tooling-service'
import * as fs from 'fs'
import * as path from 'upath'

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
  return (res && res.description) || ''
}

async function getDeployOnSave (): Promise<boolean> {
  const res = await vscode.window.showQuickPick([
    {
      label: 'true'
    }, {
      label: 'false'
    }
  ], { ignoreFocusOut: true, placeHolder: 'Deploy on save?' })
  return (res && res.label === 'true') || false
}

export default async function enterCredentials (addMode = false) {
  const config = await configService.getConfig()

  const creds: ConfigCredential = {}

  creds.url = await getUrl()
  if (!creds.url) return

  creds.username = await utils.inputText('Please enter your SFDC username', creds.username)
  if (!creds.username) return

  creds.password = await utils.inputText('Please enter your SFDC password and token', creds.password, { password: true })
  if (!creds.password) return

  creds.environment = await utils.inputText('Give this environment a name (it will be used in sfdy patches)', creds.environment)
  if (!creds.password) return

  creds.deployOnSave = await getDeployOnSave()

  if (addMode) {
    config.credentials.push(creds)
    config.currentCredential = config.credentials.length - 1
  } else {
    config.credentials[config.currentCredential] = creds
  }

  await configService.storeConfig(config)
  vscode.commands.executeCommand('setContext', 'fast-sfdc-configured', true)
  vscode.commands.executeCommand('setContext', 'fast-sfdc-more-credentials', config.credentials.length > 2)

  if (config.credentials.length === 1) {
    try {
      const editGitIgnore = await vscode.window.showQuickPick([{ label: 'Yes', value: true }, { label: 'No', value: false }], { ignoreFocusOut: true, placeHolder: 'Would you like to add fastsfdc config file to .gitignore?' })
      if (editGitIgnore && editGitIgnore.value) {
        const gitIgnorePath = path.join(utils.getWorkspaceFolder(), '.gitignore')
        fs.appendFileSync(gitIgnorePath, `\n**/${configService.getConfigFileName()}\n`)
      }
    } catch (err) {
      vscode.window.showErrorMessage('There was a problem updating the .gitignore file')
    }
  }

  try {
    StatusBar.startLoading()
    await connector.connect(config)
    toolingService.resetMetadataContainer()
    StatusBar.stopLoading()
    vscode.window.showInformationMessage('Credentials ok!')
  } catch (error) {
    StatusBar.stopLoading()
    vscode.window.showErrorMessage('Wrong credentials. Fix them to retry')
  }
}
