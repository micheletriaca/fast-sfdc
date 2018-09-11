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
  const filename = parsers.getFilename(doc)

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
  const bundleName = parsers.getAuraBundleName(doc)
  const auraDefType = parsers.getAuraDefType(doc)
  const res = await sfdcConnector.query(`SELECT
    Id
    FROM AuraDefinition
    WHERE AuraDefinitionBundle.DeveloperName = '${bundleName}'
    AND DefType = '${auraDefType}'
  `)
  if (!res.records[0]) throw Error('File not found on Salesforce server')
  const record = res.records[0]
  try {
    await sfdcConnector.editObjInMetadataContainer({ ...record, Source: doc.getText() }, 'AuraDefinition')
    diagnosticCollection.set(doc.uri, [])
    done('👍🏻')
  } catch (e) {
    updateProblemsPanelFromAuraError(e, doc)
    done('👎🏻')
  }
}

const compileMetadataContainerObject = async (doc: vscode.TextDocument, done: DoneCallback) => {
  const compile = await toolingService.requestCompile()
  const results = await compile({
    Body: doc.getText(),
    FullName: parsers.getFilename(doc)
  }, parsers.getToolingType(doc))
  updateProblemsPanel(results.DeployDetails.componentFailures, doc)
  done(results.State === 'Completed' ? '👍🏻' : '👎🏻')
}

export default async function compile (doc: vscode.TextDocument) {
  const type = parsers.getToolingType(doc)
  if (!type) return
  const cfg = await configService.getConfig()
  if (!cfg.stored) return

  StatusBar.startLongJob(async done => {
    try {
      switch (type) {
        case 'AuraDefinition': await compileAuraDefinition(doc, done); break
        default: await compileMetadataContainerObject(doc, done)
      }
    } catch (e) {
      vscode.window.showErrorMessage('Error during compile: ' + e)
      done('👎🏻')
    }
  })
}
