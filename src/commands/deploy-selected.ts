import deploy from './deploy'
import * as vscode from 'vscode'
import * as path from 'upath'
import * as fs from 'fs'
import utils from '../utils/utils'

const basePath = path.join(utils.getWorkspaceFolder(), 'src') + '/'
const isInContext = (p: string) => p.startsWith(basePath)
const isFolder = (p: string) => fs.statSync(path.resolve(utils.getWorkspaceFolder(), 'src', p)).isDirectory()

export default function deploySelected (uri: vscode.Uri, allUris: vscode.Uri[], destructive = false) {
  if (allUris && allUris.length) {
    deploy(false, destructive, allUris
      .map(x => path.toUnix(x.fsPath))
      .filter(x => isInContext(x))
      .map(x => x.substring(basePath.length))
      .map(x => isFolder(x) ? x + '/**/*' : x))
  } else if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
    const fileName = path.toUnix(vscode.window.activeTextEditor.document.fileName)
    if (isInContext(fileName)) {
      deploy(false, destructive, [fileName.substring(basePath.length)])
    }
  }
}
