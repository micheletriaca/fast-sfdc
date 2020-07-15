import * as vscode from 'vscode'
import configService from '../services/config-service'

async function showToggleOutputWindowMenu (): Promise<boolean> {
  const res = await vscode.window.showQuickPick(
    [
      { label: 'Yes' },
      { label: 'No' }
    ],
    {
      ignoreFocusOut: true,
      placeHolder: 'Pop Output Window on SFDC actions?'
    }
  )
  return res ? res.label === 'Yes' : false
}

export default async function toggleOutputWindowVisibility () {
  const config = await configService.getConfig()

  config.showOutputWindow = await showToggleOutputWindowMenu()

  await configService.storeConfig(config)

  vscode.window.showInformationMessage('Saved!')
}
