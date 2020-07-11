import * as vscode from 'vscode'
import TelemetryReporter from 'vscode-extension-telemetry'

const channel = vscode.window.createOutputChannel('Fast-Sfdc')
export default channel

const diagnosticCollection = vscode.languages.createDiagnosticCollection('FastSfdc')

class Reporter {
  private reporter: TelemetryReporter

  constructor () {
    const extensionId = 'm1ck83.fast-sfdc'
    const extension = vscode.extensions.getExtension(extensionId)!
    const extensionVersion = extension.packageJSON.version
    const innocentKitten = Buffer.from('MWU0ZWZhZGItNWE3Mi00OTQxLWFhNmMtZWY2ZTY5MGNlYjZm', 'base64').toString()
    this.reporter = new TelemetryReporter(extensionId, extensionVersion, innocentKitten)
  }

  sendEvent (cmd: string, props = {}, measurements = {}) {
    this.reporter.sendTelemetryEvent(cmd, props, measurements)
  }
}

const reporter = new Reporter()

export { diagnosticCollection, reporter }
