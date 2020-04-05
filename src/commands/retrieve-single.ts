import * as vscode from 'vscode'
import retrieve from './retrieve'

export default function retrieveSingle (fileUri: vscode.Uri) {
  if (fileUri) {
    retrieve(false, fileUri.path)
  } else if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
    const fileName = vscode.window.activeTextEditor.document.fileName
    retrieve(false, fileName)
  }
}
