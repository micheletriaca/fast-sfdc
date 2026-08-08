import retrieve from './retrieve'
import * as vscode from 'vscode'
import * as path from 'upath'
import * as fs from 'fs'
import utils from '../utils/utils'
import configService from '../services/config-service'
import { resolveSourceLayout } from '../services/source-layout-service'

export default function retrieveSelected (uri: vscode.Uri, allUris: vscode.Uri[]) {
  const layout = resolveSourceLayout(utils.getWorkspaceFolder(), configService.getSfdyConfigSync())
  const isFolder = (p: string) => fs.statSync(path.resolve(layout.root, p)).isDirectory()
  if (allUris && allUris.length) {
    retrieve(allUris
      .map(x => path.toUnix(x.fsPath))
      .filter(layout.contains)
      .map(layout.toRelativePath)
      .map(x => isFolder(x) ? x + '/**/*' : x))
  } else if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
    const fileName = path.toUnix(vscode.window.activeTextEditor.document.fileName)
    if (layout.contains(fileName)) {
      retrieve([layout.toRelativePath(fileName)])
    }
  }
}
