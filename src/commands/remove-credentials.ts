import * as vscode from 'vscode'
import configService from '../services/config-service'
import { ConfigCredential } from '../fast-sfdc'

async function showCredsMenu (credentials: ConfigCredential[], currentCredential: number): Promise<string | undefined> {
  return (await vscode.window.showQuickPick(credentials
    .filter((x, idx) => idx !== currentCredential)
    .map((x, idx) => ({ label: '$(person) ' + x.username!, idx }))
  ))?.label
}

export default async function removeCredentials () {
  const config = await configService.getConfig()
  const selUsername = await showCredsMenu(config.credentials, config.currentCredential)
  if (!selUsername) return

  await configService.storeConfig({ ...config, credentials: config.credentials.filter(x => x.username !== selUsername) })
  vscode.window.showInformationMessage('Credential removed!')
}
