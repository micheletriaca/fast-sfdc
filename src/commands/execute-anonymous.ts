import * as vscode from 'vscode'
import * as path from 'upath'
import sfdcConnector from '../sfdc-connector'
import statusbar from '../statusbar'
import utils from '../utils/utils'

// TODO: cambiare name e usare { diagnosticCollection } in logger?
const diagnosticCollection = vscode.languages.createDiagnosticCollection('FastSfdc-DebugLog')

export default async function executeAnonymous () {
  const editor = vscode.window.activeTextEditor
  if (!editor) return
  const selection = editor.selection
  const text = editor.document.getText(!selection.isEmpty ? selection : undefined)
  if (!text) return

  diagnosticCollection.clear()
  statusbar.startLongJob(async done => {
    const res = await sfdcConnector.executeAnonymous(text)
    if (res.compiled === 'false') {
      const line = (selection.isEmpty ? 0 : editor.selection.start.line) + parseInt(res.line, 10) - 1
      const col = (selection.isEmpty ? 0 : editor.selection.start.character) + parseInt(res.column, 10) - 1
      diagnosticCollection.set(editor.document.uri, [new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(line, col), new vscode.Position(line, col + 1)),
        res.compileProblem,
        vscode.DiagnosticSeverity.Error
      )])
      done('👎🏻')
    } else {
      const newFile = vscode.Uri.parse('untitled:' + path.join(utils.getWorkspaceFolder(), 'debuglog.dbg'))
      const document = await vscode.workspace.openTextDocument(newFile)
      const edit = new vscode.WorkspaceEdit()
      edit.insert(newFile, new vscode.Position(0, 0), res.debugLog)
      await vscode.workspace.applyEdit(edit)
      await vscode.window.showTextDocument(document)
      done('👍🏻')
    }
  })
}
