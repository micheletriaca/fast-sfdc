import * as vscode from 'vscode'
import StatusBar from '../statusbar'
import parsers from '../utils/parsers'
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

    const docRes = await vscode.workspace.openTextDocument({
      content: JSON.stringify(res, null, 2),
      language: 'json'
    })
    await vscode.window.showTextDocument(docRes)
  })
}
