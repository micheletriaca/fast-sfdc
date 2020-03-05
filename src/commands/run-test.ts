import StatusBar from '../statusbar'
import sfdcConnector from '../sfdc-connector'
import logger from '../logger'

const printResults = (result: any) => {
  logger.show()

  logger.appendLine(`*** Test execution results ***`)
  result.successes.forEach((v: any) => {
    logger.appendLine(`${v.name}.${v.methodName} - OK`)
  })

  result.failures.forEach((v: any) => {
    logger.appendLine(`${v.name}.${v.methodName} - KO: ${v.message}. ${v.stackTrace}`)
  })
}

export default async function runTest (className: string, methodName: string) {
  StatusBar.startLongJob(async done => {
    let request: any = { className }
    if (methodName) request.testMethods = [methodName]
    try {
      const res = await sfdcConnector.runTestSync([request])
      printResults(res)
      done('👍🏻')
    } catch (e) {
      return done(e)
    }
  })
}
