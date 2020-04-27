import deploy from './deploy'
import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

const basePath = path.join(vscode.workspace.rootPath as string, 'src') + '/'
const isInContext = (uri: vscode.Uri) => uri.path.startsWith(basePath)
const isFolder = (p: string) => fs.statSync(path.resolve(vscode.workspace.rootPath || '', 'src', p)).isDirectory()

export default async function destroySelected (uri: vscode.Uri, allUris: vscode.Uri[]) {
  const filesToDelete = (allUris || [])
    .filter(x => isInContext(x))
    .map(x => x.path.substring(basePath.length))
    .map(x => isFolder(x) ? x + '/**/*' : x)

  if (filesToDelete.length === 0 && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
    const fileName = vscode.window.activeTextEditor.document.fileName
    if (isInContext(vscode.Uri.file(fileName))) {
      filesToDelete.push(fileName.substring(basePath.length))
    }
  }

  const deletingABundle = filesToDelete.some(x => /((lwc)|(aura))\/.*\/.*/.test(x) || /staticresources\/.*\/.*/.test(x))
  const msg = `Are you sure?${deletingABundle ? ' WARNING: deleting a file that is part of a bundle (LWC, Aura, StaticResource) will cause the ENTIRE bundle to be deleted. To delete a single item of the bundle, just delete the file and re-deploy the bundle' : ''}`
  const res = await vscode.window.showErrorMessage(msg, 'No', 'Yes')
  if (res === 'Yes') deploy(false, true, filesToDelete)
}
