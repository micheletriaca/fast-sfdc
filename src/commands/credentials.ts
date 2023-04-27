import * as vscode from 'vscode'
import configService from '../services/config-service'
import connector from '../sfdc-connector'
import StatusBar from '../statusbar'
import utils from '../utils/utils'
import { ConfigCredential } from '../fast-sfdc'
import toolingService from '../services/tooling-service'
import * as auth from 'sfdy/src/auth'
import * as constants from 'sfdy/src/utils/constants'
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
    }, {
      label: 'Custom domain',
      description: 'custom'
    }
  ], { ignoreFocusOut: true })
  return (res && res.description) || ''
}

async function getAuthType (): Promise<string> {
  const res = await vscode.window.showQuickPick([
    {
      label: 'Username + password and token',
      description: 'userpwd'
    }, {
      label: 'OAuth2 flow',
      description: 'oauth2'
    }
  ], { ignoreFocusOut: true })
  return (res && res.description) || ''
}

async function getDeployOnSave (): Promise<boolean> {
  const res = await vscode.window.showQuickPick(
    [{ label: 'true' }, { label: 'false' }],
    { ignoreFocusOut: true, placeHolder: 'Compile on save?' }
  )
  return (res && res.label === 'true') || false
}

export default async function enterCredentials (addMode = false) {
  const config = await configService.getConfig()

  const creds: ConfigCredential = addMode ? {} : config.credentials[config.currentCredential]

  creds.type = await getAuthType()
  if (!creds.type) return

  creds.url = await getUrl()
  if (creds.url === 'custom') {
    creds.url = await utils.inputText('Please enter the domain', 'DOMAIN[.sandbox].my.salesforce.com')
    if (creds.url) creds.url = creds.url.replace(/https?:\/\//i, '').replace(/\/$/, '')
  }
  if (!creds.url) return

  if (creds.type === 'userpwd') {
    creds.username = await utils.inputText('Please enter your SFDC username', creds.username, {
      validateInput: v => {
        if (config.credentials.find((x, idx) => x.username === v && (addMode || idx !== config.currentCredential))) {
          return 'Username already configured'
        }
        return null
      }
    })
    if (!creds.username) return

    creds.password = await utils.inputText('Please enter your SFDC password and token', creds.password, { password: true })
    if (!creds.password) return
  }

  creds.environment = await utils.inputText('Give this environment a name (it will be used in sfdy patches)', creds.environment)
  creds.deployOnSave = await getDeployOnSave()

  if (creds.type === 'oauth2') {
    const infos = await auth(creds.url, constants.DEFAULT_CLIENT_ID, undefined, 3000)
    creds.username = infos.userInfo.username
    creds.password = infos.oauth2.refresh_token
    creds.instanceUrl = infos.oauth2.instance_url
    if (config.credentials.find((x, idx) => x.username === creds.username && (addMode || idx !== config.currentCredential))) {
      vscode.window.showErrorMessage('Username already configured')
      return
    }
  }

  if (addMode) {
    config.credentials.push(creds)
    config.currentCredential = config.credentials.length - 1
  }

  if (!config.stored) {
    try {
      const editGitIgnore = await vscode.window.showQuickPick([
        { label: 'Yes', value: true },
        { label: 'No', value: false }
      ], {
        ignoreFocusOut: true,
        placeHolder: 'Would you like to add fastsfdc config file to .gitignore?'
      })
      if (editGitIgnore?.value) {
        const gitIgnorePath = path.join(utils.getWorkspaceFolder(), '.gitignore')
        fs.appendFileSync(gitIgnorePath, `\n**/${configService.getConfigFileName()}\n`)
      }
    } catch (err) {
      vscode.window.showErrorMessage('There was a problem updating the .gitignore file')
    }
  }

  await configService.storeConfig(config)
  vscode.commands.executeCommand('setContext', 'fast-sfdc-configured', true)

  StatusBar.startLongJob(async done => {
    try {
      await connector.connect(config)
      await toolingService.resetMetadataContainer()
      vscode.commands.executeCommand('FastSfdc.refreshPackageTreeview')
      vscode.window.showInformationMessage('Credentials ok!')
      done('👍🏻')
    } catch (error) {
      vscode.window.showErrorMessage('Wrong credentials. Fix them to retry')
      done('👎🏻')
    }
  })
}
