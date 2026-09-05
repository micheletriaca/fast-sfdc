import * as vscode from 'vscode'
import sfdcConnector from '../sfdc-connector'
import parsers from '../utils/parsers'
import { getCoverageLines, ApexCoverageRecord, sourcesMatch } from '../utils/test-coverage'
import TestCoverageState, { TestCoverageLines } from '../utils/test-coverage-state'

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
const enabledDocuments = new TestCoverageState()

const getEditors = (document: vscode.TextDocument): vscode.TextEditor[] =>
  vscode.window.visibleTextEditors.filter(editor => editor.document.uri.toString() === document.uri.toString())

const getCoverageRanges = (document: vscode.TextDocument, lines: TestCoverageLines) => {
  const coveredLineSet = new Set(lines.coveredLines)
  return {
    coveredRanges: lines.coveredLines
      .filter(line => line <= document.lineCount)
      .map(line => document.lineAt(line - 1).range),
    uncoveredRanges: lines.uncoveredLines
      .filter(line => !coveredLineSet.has(line) && line <= document.lineCount)
      .map(line => document.lineAt(line - 1).range)
  }
}

const applyCoverage = (editor: vscode.TextEditor, lines: TestCoverageLines) => {
  const { coveredRanges, uncoveredRanges } = getCoverageRanges(editor.document, lines)
  editor.setDecorations(coveredDecoration, coveredRanges)
  editor.setDecorations(uncoveredDecoration, uncoveredRanges)
}

const clearCoverage = (document: vscode.TextDocument) => {
  getEditors(document).forEach(editor => {
    editor.setDecorations(coveredDecoration, [])
    editor.setDecorations(uncoveredDecoration, [])
  })
  enabledDocuments.clear(document.uri.toString())
}

export const toggleTestCoverage = async (document: vscode.TextDocument): Promise<void> => {
  if (!parsers.isApexCoverageSupported(document.fileName)) return
  const documentId = document.uri.toString()
  if (enabledDocuments.has(documentId)) {
    clearCoverage(document)
    return
  }

  const apexName = parsers.getFilename(document.fileName)
  const apexType = parsers.getApexCoverageType(document.fileName)
  const records = apexType === 'ApexTrigger'
    ? await sfdcConnector.findApexTriggersByNames([apexName])
    : await sfdcConnector.findApexClassesByNames([apexName])
  const apexClass = records.find(record => record.Name === apexName)
  if (!apexClass) throw Error(`${apexType === 'ApexTrigger' ? 'Apex trigger' : 'Apex class'} '${apexName}' was not found in the connected org`)

  if (!sourcesMatch(document.getText(), apexClass.Body)) {
    const answer = await vscode.window.showWarningMessage(
      'Local file differs from remote. Show covered lines anyway?',
      'Yes', 'No'
    )
    if (answer !== 'Yes') return
  }

  const coverageRecords = await sfdcConnector.queryAll(`SELECT Coverage FROM ApexCodeCoverage WHERE ApexClassOrTriggerId = '${apexClass.Id}'`) as ApexCoverageRecord[]
  if (coverageRecords.length === 0) {
    await vscode.window.showInformationMessage('No test classes have run to cover this Apex class.')
    return
  }
  const { coveredLines, uncoveredLines } = getCoverageLines(coverageRecords)
  const coverageLines = { coveredLines, uncoveredLines }
  getEditors(document).forEach(editor => {
    applyCoverage(editor, coverageLines)
  })
  enabledDocuments.enable(documentId, coverageLines)
}

export const restoreTestCoverage = (editor: vscode.TextEditor) => {
  const coverageLines = enabledDocuments.get(editor.document.uri.toString())
  if (coverageLines) applyCoverage(editor, coverageLines)
}

export const disposeTestCoverage = () => {
  coveredDecoration.dispose()
  uncoveredDecoration.dispose()
}

export const clearTestCoverage = (document: vscode.TextDocument) => clearCoverage(document)

export default toggleTestCoverage
