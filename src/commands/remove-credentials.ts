import * as vscode from 'vscode'
import configService from '../services/config-service'
import { ConfigCredential } from '../fast-sfdc'

async function showCredsMenu (credentials: ConfigCredential[], currentCredential: number): Promise<string | undefined> {
  return (await vscode.window.showQuickPick(credentials
    .filter((x, idx) => idx !== currentCredential)
    .map((x, idx) => ({ val: x.username, label: '$(person) ' + x.username!, idx }))
  , { placeHolder: 'Select credential to remove' }))?.val
}

export default async function removeCredentials () {
  const config = await configService.getConfig()
  const selUsername = await showCredsMenu(config.credentials, config.currentCredential)
  if (!selUsername) return

  const credToRemoveIdx = config.credentials.findIndex(x => x.username === selUsername)
  const currentIdx = config.currentCredential

  await configService.storeConfig({
    ...config,
    credentials: config.credentials.filter(x => x.username !== selUsername),
    currentCredential: credToRemoveIdx < currentIdx ? currentIdx - 1 : currentIdx
  })
  vscode.window.showInformationMessage('Credential removed!')
}
