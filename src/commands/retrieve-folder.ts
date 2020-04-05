import retrieve from './retrieve'
import * as vscode from 'vscode'

export default function retrieveFolder (folderUri: vscode.Uri) {
  if (!/^.*\/src\/[^\/]+$/.test(folderUri.path)) return
  const path = folderUri.path.substring(folderUri.path.lastIndexOf('/') + 1) + '/**/*'
  retrieve(false, path)
}
