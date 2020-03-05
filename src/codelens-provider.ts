import * as vscode from 'vscode'
export default class CodeLensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses (document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    let codeLens: vscode.CodeLens[] = []
    codeLens.push(new vscode.CodeLens(
      new vscode.Range(0, 0, 0, 0),
      {
        command: 'FastSfdc.runTest',
        title: 'FastSfdc - Run test'
      }
    ))
    return codeLens
  }
}
