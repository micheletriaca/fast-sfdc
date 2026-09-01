import * as vscode from 'vscode'
import configService from '../services/config-service'
import { ConfigCredential } from '../fast-sfdc'
import { credentialEnvironment, credentialLabel } from '../services/credential-label-service'

async function showCredsMenu (credentials: ConfigCredential[], currentCredential: number): Promise<number | undefined> {
  return (await vscode.window.showQuickPick(credentials
    .map((credential, credentialIndex) => ({ credential, credentialIndex }))
    .filter(item => item.credentialIndex !== currentCredential)
    .map(item => ({
      credentialIndex: item.credentialIndex,
      label: `$(person) ${credentialLabel(item.credential)}`,
      description: item.credential.alias && item.credential.alias !== item.credential.environment
        ? `environment: ${credentialEnvironment(item.credential)}`
        : undefined
    }))
  , { placeHolder: 'Select credential to remove' }))?.credentialIndex
}

export default async function removeCredentials () {
  const config = await configService.getConfig()
  const credentialIndex = await showCredsMenu(config.credentials, config.currentCredential)
  if (credentialIndex === undefined) return

  const currentIdx = config.currentCredential

  await configService.storeConfig({
    ...config,
    credentials: config.credentials.filter((_, index) => index !== credentialIndex),
    currentCredential: credentialIndex < currentIdx ? currentIdx - 1 : currentIdx
  })
  vscode.window.showInformationMessage('Credential removed!')
}
