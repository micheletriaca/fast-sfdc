import * as vscode from 'vscode'
import deploy from './deploy'

export default function deploySingle (fileUri: vscode.Uri) {
  if (fileUri) {
    deploy(false, fileUri.path)
  } else if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
    const fileName = vscode.window.activeTextEditor.document.fileName
    deploy(false, fileName)
  }
}
