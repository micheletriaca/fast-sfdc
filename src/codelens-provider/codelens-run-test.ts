import * as vscode from 'vscode'
import parsers from '../utils/parsers'

const getMethodName = (document: vscode.TextDocument, startingLine: number, counter = 0): string => {
  if (counter > 1) return ''
  const regex = new RegExp('.*\(\)\s*{.*')
  let line = document.lineAt(startingLine + counter)
  return (regex.test(line.text)) ? parsers.getMethodName(line.text) : getMethodName(document, startingLine, counter + 1)
}

export default class CodeLensRunTest implements vscode.CodeLensProvider {
  async provideCodeLenses (document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const filename = parsers.getFilename(document.fileName)

    let codeLens: vscode.CodeLens[] = []
    const docLine = document.lineCount
    const isTestToken = new RegExp('@isTest', 'i')
    for (let i = 0; i < docLine - 1; i++) {
      const line = document.lineAt(i)
      if (!isTestToken.test(line.text)) continue
      const methodName = (codeLens.length > 0) ? getMethodName(document, i) : ''
      codeLens.push(new vscode.CodeLens(line.range,
        {
          command: 'FastSfdc.runTest',
          title: codeLens.length === 0 ? 'FastSfdc - Run all tests' : 'FastSfdc - Run test',
          arguments: [document, filename, methodName]
        }
      ))
    }
    return codeLens
  }
}
