import * as vscode from 'vscode'
import StatusBar from '../statusbar'
import sfdcConnector from '../sfdc-connector'
import parsers from '../utils/parsers'
import configService from '../services/config-service'
import { DoneCallback } from '../fast-sfdc'
import toolingService from '../services/tooling-service'

const diagnosticCollection = vscode.languages.createDiagnosticCollection('FastSfdc')

function updateProblemsPanel (errors: any[], doc: vscode.TextDocument) {
  diagnosticCollection.set(doc.uri, errors
    .filter(e => e.ProblemType !== 'Error')
    .map(failure => {
      const failureLineNumber = Math.abs(failure.lineNumber || failure.LineNumber || 1)
      let failureRange = doc.lineAt(Math.min(failureLineNumber - 1, doc.lineCount - 1)).range
      if (failure.columnNumber > 0) {
        failureRange = failureRange.with(new vscode.Position((failureLineNumber - 1), failure.columnNumber - 1))
      }
      return new vscode.Diagnostic(failureRange, failure.problem, failure.problemType)
    })
  )
}

function updateProblemsPanelFromAuraError (err: any, doc: vscode.TextDocument) {
  const filename = parsers.getFilename(doc.fileName)

  let failureLineNumber: number
  let failureColumnNumber: number
  let errorMessage: string
  const errorLines = /^.*\[(\d+)[:, ]+(\d+)\].*$/
  const m = err.message.match(errorLines)
  if (m) {
    const [msg, line, col] = m
    errorMessage = msg
    failureLineNumber = parseInt(line, 10) - 1
    failureColumnNumber = parseInt(col, 10)
  } else {
    const splitString = err.message.split(filename + ':')
    const partTwo = splitString.length > 1 ? splitString[1] : '1,1:' + err.message
    const idx = partTwo.indexOf(':') + 1
    const rangeArray: any[] = partTwo.substring(0, idx).split(',')
    errorMessage = partTwo.substring(idx)
    failureLineNumber = rangeArray[0] - 1
    failureColumnNumber = rangeArray[1]
  }

  let failureRange = doc.lineAt(failureLineNumber).range
  if (failureColumnNumber > 0) {
    failureRange = failureRange.with(new vscode.Position(failureLineNumber, failureColumnNumber))
  }
  diagnosticCollection.set(doc.uri, [new vscode.Diagnostic(failureRange, errorMessage, 0)])
}

const compileAuraDefinition = async (doc: vscode.TextDocument, done: DoneCallback) => {
  const bundleName = parsers.getAuraBundleName(doc.uri)
  const auraDefType = parsers.getAuraDefType(doc.fileName)
  const record = await sfdcConnector.findAuraByNameAndDefType(bundleName, auraDefType as string)
  if (!record) throw Error('File not found on Salesforce server')
  try {
    await sfdcConnector.upsertAuraObj({ ...record, Source: doc.getText() })
    diagnosticCollection.set(doc.uri, [])
    done('👍🏻')
  } catch (e) {
    updateProblemsPanelFromAuraError(e, doc)
    done('👎🏻')
  }
}

const compileMetadataContainerObject = async (doc: vscode.TextDocument, done: DoneCallback) => {
  const compile = await toolingService.requestCompile()
  const results = await compile(parsers.getToolingType(doc), {
    Body: doc.getText(),
    FullName: parsers.getFilename(doc.fileName)
  })
  updateProblemsPanel(results.DeployDetails.componentFailures, doc)
  done(results.State === 'Completed' ? '👍🏻' : '👎🏻')
}

export default async function compile (doc: vscode.TextDocument) {
  const type = parsers.getToolingType(doc)
  if (!type) return
  const cfg = await configService.getConfig()
  if (!cfg.stored) return

  StatusBar.startLongJob(async done => {
    switch (type) {
      case 'AuraDefinition': return compileAuraDefinition(doc, done)
      default: return compileMetadataContainerObject(doc, done)
    }
  })
}
