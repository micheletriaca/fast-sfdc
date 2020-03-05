import * as vscode from 'vscode'
import StatusBar from '../statusbar'
import sfdcConnector from '../sfdc-connector'

export default async function runTest (className: string, methodName: string) {
  StatusBar.startLongJob(async done => {
    let res: any = null
    let request: any = { className }
    if (methodName) request.testMethods = [methodName]
    try {
      res = await sfdcConnector.runTestSync([request])
    } catch (e) {
      return done(e)
    }
    done('👍🏻')

    const docRes = await vscode.workspace.openTextDocument({
      content: JSON.stringify({
        successes: res.successes,
        failures: res.failures
      }, null, 2),
      language: 'json'
    })
    await vscode.window.showTextDocument(docRes)
  })
}
