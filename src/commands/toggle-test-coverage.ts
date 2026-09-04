import * as vscode from 'vscode'
import sfdcConnector from '../sfdc-connector'
import parsers from '../utils/parsers'
import { getCoverageLines, ApexCoverageRecord } from '../utils/test-coverage'

const coveredDecoration = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  backgroundColor: new vscode.ThemeColor('testing.coveredBackground'),
  overviewRulerColor: new vscode.ThemeColor('testing.iconPassed'),
  overviewRulerLane: vscode.OverviewRulerLane.Left
})
const uncoveredDecoration = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  backgroundColor: new vscode.ThemeColor('testing.uncoveredBackground'),
  overviewRulerColor: new vscode.ThemeColor('testing.iconFailed'),
  overviewRulerLane: vscode.OverviewRulerLane.Left
})
const enabledDocuments = new Set<string>()

const getEditors = (document: vscode.TextDocument): vscode.TextEditor[] =>
  vscode.window.visibleTextEditors.filter(editor => editor.document.uri.toString() === document.uri.toString())

const clearCoverage = (document: vscode.TextDocument) => {
  getEditors(document).forEach(editor => {
    editor.setDecorations(coveredDecoration, [])
    editor.setDecorations(uncoveredDecoration, [])
  })
  enabledDocuments.delete(document.uri.toString())
}

export const toggleTestCoverage = async (document: vscode.TextDocument): Promise<void> => {
  const documentId = document.uri.toString()
  if (enabledDocuments.has(documentId)) {
    clearCoverage(document)
    return
  }

  const className = parsers.getFilename(document.fileName)
  const classes = await sfdcConnector.findApexClassesByNames([className])
  const apexClass = classes.find(record => record.Name === className)
  if (!apexClass) throw Error(`Apex class '${className}' was not found in the connected org`)

  const records = await sfdcConnector.queryAll(`SELECT Coverage FROM ApexCodeCoverage WHERE ApexClassOrTriggerId = '${apexClass.Id}'`) as ApexCoverageRecord[]
  if (records.length === 0) {
    await vscode.window.showInformationMessage('No test classes have run to cover this Apex class.')
    return
  }
  const { coveredLines, uncoveredLines } = getCoverageLines(records)
  const coveredLineSet = new Set(coveredLines)
  const coveredRanges = coveredLines
    .filter(line => line <= document.lineCount)
    .map(line => document.lineAt(line - 1).range)
  const uncoveredRanges = uncoveredLines
    .filter(line => !coveredLineSet.has(line) && line <= document.lineCount)
    .map(line => document.lineAt(line - 1).range)
  getEditors(document).forEach(editor => {
    editor.setDecorations(coveredDecoration, coveredRanges)
    editor.setDecorations(uncoveredDecoration, uncoveredRanges)
  })
  enabledDocuments.add(documentId)
}

export const disposeTestCoverage = () => {
  coveredDecoration.dispose()
  uncoveredDecoration.dispose()
}

export default toggleTestCoverage
