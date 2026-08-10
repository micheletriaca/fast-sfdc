import deploy from './deploy'
import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import utils from '../utils/utils'
import configService from '../services/config-service'
import { resolveSourceLayout } from '../services/source-layout-service'

export default function deploySelected (uri: vscode.Uri, allUris: vscode.Uri[]) {
  const layout = resolveSourceLayout(utils.getWorkspaceFolder(), configService.getSfdyConfigSync())
  const isFolder = (p: string) => fs.statSync(path.resolve(layout.root, p)).isDirectory()
  if (allUris && allUris.length) {
    deploy(false, false, allUris
      .map(x => x.fsPath)
      .filter(layout.contains)
      .map(layout.toRelativePath)
      .map(x => isFolder(x) ? x + '/**/*' : x))
  } else if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
    const fileName = vscode.window.activeTextEditor.document.fileName
    if (layout.contains(fileName)) {
      deploy(false, false, [layout.toRelativePath(fileName)])
    }
  }
}
