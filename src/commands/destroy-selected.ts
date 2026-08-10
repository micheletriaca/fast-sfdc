import deploy from './deploy'
import * as vscode from 'vscode'
import * as path from 'upath'
import * as fs from 'fs'
import utils from '../utils/utils'
import configService from '../services/config-service'
import { resolveSourceLayout } from '../services/source-layout-service'
import { ensureOrgWritable } from '../services/org-protection-service'

export default async function destroySelected (uri: vscode.Uri, allUris: vscode.Uri[]) {
  if (!await ensureOrgWritable('destructively deploy metadata')) return
  const layout = resolveSourceLayout(utils.getWorkspaceFolder(), configService.getSfdyConfigSync())
  const isFolder = (p: string) => fs.statSync(path.resolve(layout.root, p)).isDirectory()
  const filesToDelete = (allUris || [])
    .map(x => path.toUnix(x.fsPath))
    .filter(layout.contains)
    .map(layout.toRelativePath)
    .map(x => isFolder(x) ? x + '/**/*' : x)

  if (filesToDelete.length === 0 && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
    const fileName = path.toUnix(vscode.window.activeTextEditor.document.fileName)
    if (layout.contains(fileName)) {
      filesToDelete.push(layout.toRelativePath(fileName))
    }
  }

  const deletingABundle = filesToDelete.some(x => /((lwc)|(aura))\/.*\/.*/.test(x) || /staticresources\/.*\/.*/.test(x))
  const msg = `Are you sure?${deletingABundle ? ' WARNING: deleting a file that is part of a bundle (LWC, Aura, StaticResource) will cause the ENTIRE bundle to be deleted. To delete a single item of the bundle, just delete the file and re-deploy the bundle' : ''}`
  const res = await vscode.window.showErrorMessage(msg, 'No', 'Yes')
  if (res === 'Yes') deploy(false, true, filesToDelete)
}
