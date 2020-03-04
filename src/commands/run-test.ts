import * as vscode from 'vscode'
// import { AnyMetadata, AuraMetadata, LwcMetadata } from '../fast-sfdc'
import StatusBar from '../statusbar'
import parsers from '../utils/parsers'
// import configService from '../services/config-service'
// import toolingService from '../services/tooling-service'
// import utils from '../utils/utils'
// import * as path from 'path'
// import * as xml2js from 'xml2js'
// import * as fs from 'fs'
import sfdcConnector from '../sfdc-connector'

export default async function runTest () {
  if (!vscode.window.activeTextEditor || !vscode.window.activeTextEditor.document) return
  const filename = parsers.getFilename(vscode.window.activeTextEditor.document.fileName)

  StatusBar.startLongJob(async done => {
    let res: any = null
    try {
      res = await sfdcConnector.runTestSync([{ className: filename }])
    } catch (e) {
      return done(e)
    }
    console.log('run finish')
    console.log(res)
    done('👍🏻')

    const successesString = res.successes && res.successes.map((v: any) => [v.name, v.methodName].join('.')).join('\n')
    const errorsString = res.errors && res.errors.map((v: any) => [v.name, v.methodName].join('.')).join('\n')
    const resString = `
successes:
${successesString}

errors:
${errorsString}
`

    const docRes = await vscode.workspace.openTextDocument({
      content: resString
    })
    await vscode.window.showTextDocument(docRes)
  })
}
