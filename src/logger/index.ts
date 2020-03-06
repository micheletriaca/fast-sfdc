import * as vscode from 'vscode'

const channel = vscode.window.createOutputChannel('Fast-Sfdc')
export default channel

const diagnosticCollection = vscode.languages.createDiagnosticCollection('FastSfdc')
export { diagnosticCollection }
