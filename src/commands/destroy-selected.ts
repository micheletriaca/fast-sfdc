import deploy from './deploy'
import * as vscode from 'vscode'
import * as path from 'upath'
import * as fs from 'fs'
import utils from '../utils/utils'

const basePath = path.join(utils.getWorkspaceFolder(), 'src') + '/'
const isInContext = (p: string) => p.startsWith(basePath)
const isFolder = (p: string) => fs.statSync(path.resolve(utils.getWorkspaceFolder(), 'src', p)).isDirectory()

export default async function destroySelected (uri: vscode.Uri, allUris: vscode.Uri[]) {
  const filesToDelete = (allUris || [])
    .map(x => path.toUnix(x.fsPath))
    .filter(x => isInContext(x))
    .map(x => x.substring(basePath.length))
    .map(x => isFolder(x) ? x + '/**/*' : x)

  if (filesToDelete.length === 0 && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
    const fileName = path.toUnix(vscode.window.activeTextEditor.document.fileName)
    if (isInContext(fileName)) {
      filesToDelete.push(fileName.substring(basePath.length))
    }
  }

  const deletingABundle = filesToDelete.some(x => /((lwc)|(aura))\/.*\/.*/.test(x) || /staticresources\/.*\/.*/.test(x))
  const msg = `Are you sure?${deletingABundle ? ' WARNING: deleting a file that is part of a bundle (LWC, Aura, StaticResource) will cause the ENTIRE bundle to be deleted. To delete a single item of the bundle, just delete the file and re-deploy the bundle' : ''}`
  const res = await vscode.window.showErrorMessage(msg, 'No', 'Yes')
  if (res === 'Yes') deploy(false, true, filesToDelete)
}
