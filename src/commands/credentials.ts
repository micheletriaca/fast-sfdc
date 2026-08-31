import * as vscode from 'vscode'
import configService from '../services/config-service'
import connector from '../sfdc-connector'
import StatusBar from '../statusbar'
import utils from '../utils/utils'
import { ConfigCredential } from '../fast-sfdc'
import toolingService from '../services/tooling-service'
import * as constants from 'sfdy/constants'
import { aliasIsAvailable } from '../services/credential-label-service'
import { clearOrganizationKindCache } from '../services/org-protection-service'
import auth = require('sfdy/auth')

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

async function getReadOnlyMode (currentValue = false): Promise<boolean | undefined> {
  const writable = {
    label: 'Writable',
    description: 'Deploy, compile, and execute commands are allowed',
    value: false
  }
  const readOnly = {
    label: 'Read-only',
    description: 'Retrieve is allowed; remote changes are blocked',
    value: true
  }
  return (await vscode.window.showQuickPick(
    currentValue ? [readOnly, writable] : [writable, readOnly],
    { ignoreFocusOut: true, title: 'Access mode for this credential' }
  ))?.value
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
    creds.instanceUrl = undefined
    creds.username = await utils.inputText('Please enter your SFDC username', creds.username, {
      validateInput: value => value.trim() ? null : 'A username is required'
    })
    if (!creds.username) return

    creds.password = await utils.inputText('Please enter your SFDC password and token', creds.password, { password: true })
    if (!creds.password) return
  }

  const currentCredential = addMode ? undefined : creds
  creds.alias = await utils.inputText('Credential alias (for example uat-admin)', creds.alias || creds.environment, {
    validateInput: value => {
      if (!value.trim()) return 'A credential alias is required'
      if (!aliasIsAvailable(config.credentials, value, currentCredential)) return 'Credential alias already configured'
      return null
    }
  })
  if (!creds.alias) return
  creds.alias = creds.alias.trim()

  creds.environment = await utils.inputText(
    'Environment shared by metadata plugins and patches (for example dev, uat or prod)',
    creds.environment || creds.alias,
    { validateInput: value => value.trim() ? null : 'An environment name is required' }
  )
  if (!creds.environment) return
  creds.environment = creds.environment.trim()

  const readOnly = await getReadOnlyMode(creds.readOnly)
  if (readOnly === undefined) return
  creds.readOnly = readOnly
  if (readOnly) creds.deployOnSave = false

  if (creds.type === 'oauth2') {
    const infos = await auth(creds.url, constants.DEFAULT_CLIENT_ID, undefined, 3000)
    creds.username = infos.userInfo.username
    creds.password = infos.oauth2.refresh_token
    creds.instanceUrl = infos.oauth2.instance_url
  }

  if (addMode) {
    config.credentials.push(creds)
    config.currentCredential = config.credentials.length - 1
  }

  await configService.storeConfig(config)
  vscode.commands.executeCommand('setContext', 'fast-sfdc-configured', true)

  StatusBar.startLongJob(async done => {
    try {
      toolingService.clearLocalState()
      clearOrganizationKindCache()
      await connector.connect(config)
      vscode.commands.executeCommand('FastSfdc.refreshPackageTreeview')
      vscode.window.showInformationMessage('Credentials ok!')
      done('👍🏻')
    } catch (error) {
      vscode.window.showErrorMessage('Wrong credentials. Fix them to retry')
      done('👎🏻')
    }
  })
}
