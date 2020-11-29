import * as vscode from 'vscode'

export default class CodeLensFls implements vscode.CodeLensProvider {
  async provideCodeLenses (document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const codeLens: vscode.CodeLens[] = []
    const line = document.lineAt(0)
    codeLens.push(new vscode.CodeLens(line.range, {
      command: 'FastSfdc.editFlsProfiles',
      title: 'FastSfdc - Edit field level security',
      arguments: [document]
    }))
    return codeLens
  }
}
