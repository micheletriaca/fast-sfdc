import retrieve from './retrieve'
import * as vscode from 'vscode'
import * as path from 'upath'
import * as fs from 'fs'
import utils from '../utils/utils'

const basePath = path.join(utils.getWorkspaceFolder(), 'src') + path.sep
const isInContext = (p: string) => p.startsWith(basePath)
const isFolder = (p: string) => fs.statSync(path.resolve(utils.getWorkspaceFolder(), 'src', p)).isDirectory()

export default function retrieveSelected (uri: vscode.Uri, allUris: vscode.Uri[]) {
  if (allUris && allUris.length) {
    retrieve(allUris
      .map(x => path.toUnix(x.fsPath))
      .filter(x => isInContext(x))
      .map(x => x.substring(basePath.length))
      .map(x => isFolder(x) ? x + '/**/*' : x))
  } else if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
    const fileName = path.toUnix(vscode.window.activeTextEditor.document.fileName)
    if (isInContext(fileName)) {
      retrieve([fileName.substring(basePath.length)])
    }
  }
}
