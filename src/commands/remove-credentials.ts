import * as vscode from 'vscode'
import configService from '../services/config-service'
import { ConfigCredential } from '../fast-sfdc'

async function showCredsMenu (credentials: ConfigCredential[], currentCredential: number): Promise<number> {
  const res = await vscode.window.showQuickPick(
    credentials
      .map((x: ConfigCredential) => {
        return {
          label: x.username
        } as vscode.QuickPickItem
      })
      .filter((x: vscode.QuickPickItem, y: number) => y !== currentCredential),
    { ignoreFocusOut: true }
  )
  return res ? (credentials.findIndex(x => x.username === res.label)) : -1
}

export default async function removeCredentials () {
  const config = await configService.getConfig()

  const credIdx = await showCredsMenu(config.credentials, config.currentCredential)
  if (credIdx === -1) return

  config.credentials = config.credentials.filter((x: ConfigCredential, i: number) => i !== credIdx)

  await configService.storeConfig(config)

  vscode.commands.executeCommand('setContext', 'fast-sfdc-more-credentials', config.credentials.length > 2)

  vscode.window.showInformationMessage('Credential removed!')
}
