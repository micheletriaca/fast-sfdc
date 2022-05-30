import * as vscode from 'vscode'
import configService from '../services/config-service'
import connector from '../sfdc-connector'
import StatusBar from '../statusbar'
import { ConfigCredential } from '../fast-sfdc'
import toolingService from '../services/tooling-service'
import { prompt } from '../utils/field-builders'
import * as open from 'open'

const ADD_OTHER_CREDENTIAL = -2
const REMOVE_CREDENTIAL = -3
const REPLACE_CREDENTIAL = -4
const TOGGLE_COMPILE_ON_SAVE = -5
const OPEN_SALESFORCE_IN_BROWSER = -6
const OPEN_SALESFORCE_IN_BROWSER_CLASSIC = -7

async function showCredsMenu (credentials: ConfigCredential[], currentCredential: number): Promise<number> {
  const res = await vscode.window.showQuickPick(
    [
      { label: '$(cloud) Open Salesforce setup in browser (lex)', hidden: credentials.length === 0 },
      { label: '$(cloud) Open Salesforce setup in browser (classic)', hidden: credentials.length === 0 }
    ].concat(credentials
      .filter((x: any, y: number) => y !== currentCredential)
      .map(x => ({ label: '$(person) ' + x.username, hidden: false }))
    ).concat([
      { label: '$(add) Add credential...', hidden: false },
      { label: '$(remove) Remove credential...', hidden: credentials.length < 2 },
      { label: '$(replace) Replace current credential...', hidden: credentials.length === 0 },
      { label: '$(symbol-null) Toggle compile on save...', hidden: credentials.length === 0 }
    ].filter(x => !x.hidden))
  )

  if (!res) return -1
  else if (res.label === '$(add) Add credential...') return ADD_OTHER_CREDENTIAL
  else if (res.label === '$(remove) Remove credential...') return REMOVE_CREDENTIAL
  else if (res.label === '$(replace) Replace current credential...') return REPLACE_CREDENTIAL
  else if (res.label === '$(symbol-null) Toggle compile on save...') return TOGGLE_COMPILE_ON_SAVE
  else if (res.label === '$(cloud) Open Salesforce setup in browser (lex)') return OPEN_SALESFORCE_IN_BROWSER
  else if (res.label === '$(cloud) Open Salesforce setup in browser (classic)') return OPEN_SALESFORCE_IN_BROWSER_CLASSIC
  else return credentials.findIndex(x => '$(person) ' + x.username === res.label)
}

export default async function changeCredentials () {
  const config = await configService.getConfig()
  const credIdx = await showCredsMenu(config.credentials, config.currentCredential)
  if (credIdx === ADD_OTHER_CREDENTIAL) return vscode.commands.executeCommand('FastSfdc.addCredentials')
  else if (credIdx === REMOVE_CREDENTIAL) return vscode.commands.executeCommand('FastSfdc.removeCredentials')
  else if (credIdx === REPLACE_CREDENTIAL) return vscode.commands.executeCommand('FastSfdc.replaceCredentials')
  else if (credIdx === OPEN_SALESFORCE_IN_BROWSER || credIdx === OPEN_SALESFORCE_IN_BROWSER_CLASSIC) {
    const session = await connector.getSession(true)
    const retUrl = credIdx === OPEN_SALESFORCE_IN_BROWSER ? encodeURIComponent('/lightning/setup/SetupOneHome/home') : encodeURIComponent('/setup/systemOverview.apexp')
    const urlToOpen = 'https://' + session.instanceHostname + '/secur/frontdoor.jsp?sid=' + encodeURIComponent(session.sessionId) + '&retURL=' + retUrl
    open(urlToOpen)
    return
  } else if (credIdx === TOGGLE_COMPILE_ON_SAVE) {
    const compileOnSave = config.credentials[config.currentCredential]?.deployOnSave || false
    const newValue = await prompt(`Actual value: ${compileOnSave}`, undefined, [{ label: 'True', value: true }, { label: 'False', value: false }])()
    if (newValue !== undefined) {
      config.credentials[config.currentCredential].deployOnSave = newValue
      await configService.storeConfig(config)
    }
    return
  }

  if (credIdx === -1) return

  StatusBar.startLongJob(async done => {
    try {
      const newCfg = { ...config, currentCredential: credIdx }
      await configService.storeConfig(newCfg)
      await connector.connect(newCfg)
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
