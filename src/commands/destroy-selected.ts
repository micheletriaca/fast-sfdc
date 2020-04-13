import deploy from './deploy'
import * as vscode from 'vscode'

const isInContext = (uri: vscode.Uri) => /^.*\/src\/.*$/.test(uri.path)
const isFolder = (path: string) => !path.includes('/')

export default async function destroySelected (uri: vscode.Uri, allUris: vscode.Uri[]) {
  const filesToDelete = (allUris || [])
    .filter(x => isInContext(x))
    .map(x => x.path.substring(x.path.lastIndexOf('src/') + 4))
    .map(x => isFolder(x) ? x + '/**/*' : x)

  if (filesToDelete.length === 0 && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
    const fileName = vscode.window.activeTextEditor.document.fileName
    filesToDelete.push(fileName)
  }

  const deletingABundle = filesToDelete.some(x => /((lwc)|(aura))\/.*\/.*/.test(x))
  const msg = `Are you sure?${deletingABundle ? ' WARNING: deleting a file that is part of a bundle (LWC, Aura) will cause the ENTIRE bundle to be deleted. To delete a single item of the bundle, just delete the file and re-deploy the bundle' : ''}`
  const res = await vscode.window.showErrorMessage(msg, 'No', 'Yes')
  if (res === 'Yes') deploy(false, true, filesToDelete)
}
