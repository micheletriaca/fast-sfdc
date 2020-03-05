import StatusBar from '../statusbar'
import sfdcConnector from '../sfdc-connector'
import logger from '../logger'

export interface Result {
  successes: TestResult[],
  failures: TestResult[]
}

export interface TestResult {
  name: string,
  methodName: string,
  message: string,
  stackTrace: string
}

const printResults = (result: Result) => {
  logger.appendLine(`*** Test execution results ***`)
  result.successes.forEach((v: TestResult) => {
    logger.appendLine(`${v.name}.${v.methodName} - OK`)
  })

  result.failures.forEach((v: TestResult) => {
    logger.appendLine(`${v.name}.${v.methodName} - KO: ${v.message}. ${v.stackTrace}`)
  })
  logger.show()
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
