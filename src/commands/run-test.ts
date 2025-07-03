import * as vscode from 'vscode'
import StatusBar from '../statusbar'
import sfdcConnector from '../sfdc-connector'
import logger, { diagnosticCollection } from '../logger'

import { TestExecutionResult, TestResult, CodeCoverage } from '../fast-sfdc'

const lineString = 'line '
const getStackTraceRange = (stackTrace: string, doc: vscode.TextDocument): vscode.Range => {
  const line = stackTrace.substring(stackTrace.lastIndexOf(lineString) + lineString.length, stackTrace.lastIndexOf(','))
  const docLine = doc.lineAt(parseInt(line, 10) - 1 || 0)
  const tmpRange = docLine.range || new vscode.Range(0, 0, 0, 0)
  const failureRange = new vscode.Range(
    tmpRange.start.line, docLine.firstNonWhitespaceCharacterIndex,
    tmpRange.end.line, tmpRange.end.character
  )
  return failureRange
}

function updateProblemsPanel (errors: any[], doc: vscode.TextDocument) {
  diagnosticCollection.set(
    doc.uri,
    errors.map(v => {
      const failureRange = getStackTraceRange(v.stackTrace, doc)
      return new vscode.Diagnostic(failureRange, `${v.message}. ${v.stackTrace}`, vscode.DiagnosticSeverity.Error)
    })
  )
}

const printResults = (result: TestExecutionResult, document: vscode.TextDocument) => {
  logger.appendLine('*** Test execution results ***')
  result.successes.forEach((v: TestResult) => {
    logger.appendLine(`${v.name}.${v.methodName} - OK`)
  })

  result.failures.forEach((v: TestResult) => {
    logger.appendLine(`${v.name}.${v.methodName} - KO: ${v.message}. ${v.stackTrace}`)
  })

  logger.appendLine('*** Coverage ***')
  result.codeCoverage
    .filter((v: CodeCoverage) => v.numLocationsNotCovered !== v.numLocations)
    .sort((a: CodeCoverage, b: CodeCoverage) => a.name.localeCompare(b.name))
    .forEach((v: CodeCoverage) => {
      logger.appendLine(`${v.name}: ${Math.floor((v.numLocations - v.numLocationsNotCovered) / v.numLocations * 100)}%`)
    })

  logger.show()

  updateProblemsPanel(result.failures, document)
}

export default async function runTest (document: vscode.TextDocument, className: string, methodName: string) {
  StatusBar.startLongJob(async done => {
    logger.show()
    logger.appendLine('Executing tests...')
    const request: any = { className }
    if (methodName) request.testMethods = [methodName]
    try {
      const res = await sfdcConnector.runTestSync([request])
      printResults(res, document)
      done('👍🏻')
    } catch (e) {
      done('👎🏻')
      throw e
    }
  })
}
