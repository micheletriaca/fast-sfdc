import * as vscode from 'vscode'
import configService from '../services/config-service'
import connector from '../sfdc-connector'
import StatusBar from '../statusbar'
import { ConfigCredential } from '../fast-sfdc'
import toolingService from '../services/tooling-service'
import { prompt } from '../utils/field-builders'
import utils from '../utils/utils'
import logger from '../logger'
import { aliasIsAvailable, credentialEnvironment, credentialLabel } from '../services/credential-label-service'
import { clearOrganizationKindCache } from '../services/org-protection-service'
import open = require('open')

const ADD_OTHER_CREDENTIAL = -2
const REMOVE_CREDENTIAL = -3
const REPLACE_CREDENTIAL = -4
const TOGGLE_DEPLOY_ON_SAVE = -5
const OPEN_SALESFORCE_IN_BROWSER = -6
const OPEN_SALESFORCE_IN_BROWSER_CLASSIC = -7
const CHANGE_READ_ONLY_MODE = -8
const CHANGE_ALIAS = -9
const CHANGE_ENVIRONMENT = -10

async function showCredsMenu (credentials: ConfigCredential[], currentCredential: number): Promise<number> {
  type CredentialMenuItem = vscode.QuickPickItem & { credentialIndex?: number; action?: number }
  const items: CredentialMenuItem[] = [
    { label: '$(cloud) Open Salesforce setup in browser (lex)', action: OPEN_SALESFORCE_IN_BROWSER },
    { label: '$(cloud) Open Salesforce setup in browser (classic)', action: OPEN_SALESFORCE_IN_BROWSER_CLASSIC },
    ...credentials
      .map((credential, credentialIndex) => ({ credential, credentialIndex }))
      .filter(item => item.credentialIndex !== currentCredential)
      .map(item => ({
        label: `$(person) ${credentialLabel(item.credential)}`,
        description: item.credential.alias && item.credential.alias !== item.credential.environment
          ? `environment: ${credentialEnvironment(item.credential)}`
          : undefined,
        credentialIndex: item.credentialIndex
      })),
    { label: '$(add) Add credential...', action: ADD_OTHER_CREDENTIAL },
    { label: '$(remove) Remove credential...', action: REMOVE_CREDENTIAL },
    { label: '$(replace) Replace current credential...', action: REPLACE_CREDENTIAL },
    { label: '$(edit) Change alias...', action: CHANGE_ALIAS },
    { label: '$(edit) Change environment...', action: CHANGE_ENVIRONMENT },
    { label: '$(lock) Change read-only mode...', action: CHANGE_READ_ONLY_MODE },
    { label: '$(symbol-null) Change deploy on save...', action: TOGGLE_DEPLOY_ON_SAVE }
  ]

  const res = await vscode.window.showQuickPick(
    items.filter(item => {
      if (item.action === OPEN_SALESFORCE_IN_BROWSER || item.action === OPEN_SALESFORCE_IN_BROWSER_CLASSIC) return credentials.length > 0
      if (item.action === REMOVE_CREDENTIAL) return credentials.length > 1
      if (item.action === TOGGLE_DEPLOY_ON_SAVE) return credentials.length > 0 && !credentials[currentCredential]?.readOnly
      if ([REPLACE_CREDENTIAL, CHANGE_ALIAS, CHANGE_ENVIRONMENT, CHANGE_READ_ONLY_MODE].includes(item.action!)) return credentials.length > 0
      return true
    })
  )

  if (!res) return -1
  return res.action === undefined ? res.credentialIndex! : res.action
}

export default async function changeCredentials () {
  const config = await configService.getConfig()
  const credIdx = await showCredsMenu(config.credentials, config.currentCredential)
  if (credIdx === ADD_OTHER_CREDENTIAL) return vscode.commands.executeCommand('FastSfdc.addCredentials')
  else if (credIdx === REMOVE_CREDENTIAL) return vscode.commands.executeCommand('FastSfdc.removeCredentials')
  else if (credIdx === REPLACE_CREDENTIAL) return vscode.commands.executeCommand('FastSfdc.replaceCredentials')
  else if (credIdx === CHANGE_ALIAS) {
    const credential = config.credentials[config.currentCredential]
    const alias = await utils.inputText('Credential alias', credential.alias || credential.environment, {
      validateInput: value => {
        if (!value.trim()) return 'A credential alias is required'
        if (!aliasIsAvailable(config.credentials, value, credential)) return 'Credential alias already configured'
        return null
      }
    })
    if (!alias) return
    credential.alias = alias.trim()
    await configService.storeConfig(config)
    StatusBar.initStatusBar()
    vscode.window.showInformationMessage(`Credential alias changed to ${credential.alias}`)
    return
  } else if (credIdx === CHANGE_ENVIRONMENT) {
    const credential = config.credentials[config.currentCredential]
    const environment = await utils.inputText(
      'Environment shared by metadata plugins and patches',
      credential.environment || credential.alias,
      { validateInput: value => value.trim() ? null : 'An environment name is required' }
    )
    if (!environment) return
    credential.environment = environment.trim()
    await configService.storeConfig(config)
    StatusBar.initStatusBar()
    vscode.window.showInformationMessage(`Credential environment changed to ${credential.environment}`)
    return
  } else if (credIdx === OPEN_SALESFORCE_IN_BROWSER || credIdx === OPEN_SALESFORCE_IN_BROWSER_CLASSIC) {
    const session = await connector.getSession(true)
    const retUrl = credIdx === OPEN_SALESFORCE_IN_BROWSER ? encodeURIComponent('/lightning/setup/SetupOneHome/home') : encodeURIComponent('/setup/systemOverview.apexp')
    const urlToOpen = 'https://' + session.instanceHostname + '/secur/frontdoor.jsp?sid=' + encodeURIComponent(session.sessionId) + '&retURL=' + retUrl
    open(urlToOpen)
    return
  } else if (credIdx === TOGGLE_DEPLOY_ON_SAVE) {
    const deployOnSave = config.credentials[config.currentCredential]?.deployOnSave
    const currentValue = deployOnSave === undefined ? 'not configured' : deployOnSave ? 'enabled' : 'disabled'
    const newValue = await prompt(`Deploy on save is currently ${currentValue}`, undefined, [{ label: 'Enabled', value: true }, { label: 'Disabled', value: false }])()
    if (newValue !== undefined) {
      config.credentials[config.currentCredential].deployOnSave = newValue
      await configService.storeConfig(config)
    }
    return
  } else if (credIdx === CHANGE_READ_ONLY_MODE) {
    const credential = config.credentials[config.currentCredential]
    const currentValue = credential.readOnly ? 'enabled' : 'disabled'
    const newValue = await prompt(`Read-only mode is currently ${currentValue}`, undefined, [
      { label: 'Enabled', value: true },
      { label: 'Disabled', value: false }
    ])()
    if (newValue !== undefined) {
      credential.readOnly = newValue
      if (newValue) credential.deployOnSave = false
      await configService.storeConfig(config)
      StatusBar.initStatusBar()
    }
    return
  }

  if (credIdx === -1) return

  StatusBar.startLongJob(async done => {
    try {
      const newCfg = { ...config, currentCredential: credIdx }
      const currentCred = newCfg.credentials[credIdx]
      await configService.storeConfig(newCfg)
      toolingService.clearLocalState()
      clearOrganizationKindCache()
      await connector.connect(newCfg)
      const sessionInfos = await connector.getSession()
      if (currentCred.type === 'oauth2' && currentCred.instanceUrl !== 'https://' + sessionInfos.instanceHostname) {
        currentCred.instanceUrl = 'https://' + sessionInfos.instanceHostname
        await configService.storeConfig(newCfg)
      }
      vscode.commands.executeCommand('FastSfdc.refreshPackageTreeview')
      vscode.window.showInformationMessage('Credentials ok!')
      done('👍🏻')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.appendLine(`Unable to switch Salesforce credentials: ${message}`)
      vscode.window.showErrorMessage(`Unable to switch Salesforce credentials: ${message}`)
      done('👎🏻')
    }
  })
}
