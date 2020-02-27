import * as vscode from 'vscode'
import retrieve from './retrieve'

export default function retrieveSingle () {
  if (!vscode.window.activeTextEditor || !vscode.window.activeTextEditor.document) return
  const fileName = vscode.window.activeTextEditor.document.fileName
  retrieve(false, fileName)
}
