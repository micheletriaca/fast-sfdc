import * as vscode from 'vscode'

const SOUND_SETTING = 'retrieveSound'

export default async function toggleRetrieveSound (): Promise<void> {
  const configuration = vscode.workspace.getConfiguration('fast-sfdc')
  const enabled = configuration.get<boolean>(SOUND_SETTING, true)
  const nextValue = !enabled
  await configuration.update(SOUND_SETTING, nextValue, vscode.ConfigurationTarget.Workspace)
  await vscode.window.showInformationMessage(`Retrieve completion sound ${nextValue ? 'enabled' : 'disabled'}.`)
}
