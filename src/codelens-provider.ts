import * as vscode from 'vscode'
import parsers from './utils/parsers'

export default class CodeLensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses (document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const filename = parsers.getFilename(document.fileName)
    const regex = new RegExp('.*\(\)\s*{.*')

    // non va bene perché le righe sono sempre singole
    // const fullRegex = new RegExp('.*\@isTest.*\(\)\s*{.*', 's')

    let codeLens: vscode.CodeLens[] = []
    const docLine = document.lineCount
    let counter = 0 // primo @isTest rappresenta tutta la classe
    for (let i = 0; i < docLine - 1; i++) {
      let line = document.lineAt(i)

      // vanno skippate le righe commentate
      if (line.text.indexOf('@isTest') !== -1) {
        counter++

        let methodName: string = ''
        if (counter > 1) {
          if (regex.test(line.text)) {
            methodName = parsers.getMethodName(line.text)
          } else {
            // verificare che next esista
            let nextLine = document.lineAt(i + 1)
            if (regex.test(nextLine.text)) {
              methodName = parsers.getMethodName(nextLine.text)
            }
          }
        }

        codeLens.push(new vscode.CodeLens(line.range,
          {
            command: 'FastSfdc.runTest',
            title: i === 0 ? 'FastSfdc - Run all tests' : 'FastSfdc - Run test',
            arguments: [filename, methodName]
          }
        ))
      }
    }
    return codeLens
  }
}
