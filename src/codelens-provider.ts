import * as vscode from 'vscode'
export default class CodeLensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses (document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    let codeLens: vscode.CodeLens[] = []
    const docLine = document.lineCount
    for (let i = 0; i < docLine - 1; i++) {
      let line = document.lineAt(i)
      if (line.text.indexOf('@isTest') !== -1) {
        codeLens.push(new vscode.CodeLens(line.range,
          {
            command: 'FastSfdc.runTest',
            title: i === 0 ? 'FastSfdc - Run all tests' : 'FastSfdc - Run test'
          }
        ))
      }
    }
    return codeLens
  }
}
