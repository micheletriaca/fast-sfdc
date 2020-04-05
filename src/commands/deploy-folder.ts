import * as vscode from 'vscode'
import deploy from './deploy'

export default function deployFolder (folderUri: vscode.Uri) {
  if (!/^.*\/src\/[^\/]+$/.test(folderUri.path)) return
  const path = folderUri.path.substring(folderUri.path.lastIndexOf('/') + 1) + '/**/*'
  deploy(false, path)
}
