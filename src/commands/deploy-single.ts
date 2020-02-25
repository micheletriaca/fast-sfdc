import * as vscode from 'vscode'
import deploy from './deploy'

export default function deploySingle () {
  if (!vscode.window.activeTextEditor || !vscode.window.activeTextEditor.document) return
  const fileName = vscode.window.activeTextEditor.document.fileName
  deploy(false, fileName)
}
