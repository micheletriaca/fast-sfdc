import * as vscode from 'vscode'
import { TelemetryReporter } from '@vscode/extension-telemetry'

let channel: vscode.OutputChannel | undefined
let diagnostics: vscode.DiagnosticCollection | undefined
let debugDiagnostics: vscode.DiagnosticCollection | undefined
let extensionContext: vscode.ExtensionContext | undefined
let disposed = false
let telemetryEnabled = false

const getChannel = () => {
  if (!channel && extensionContext && !disposed) {
    channel = vscode.window.createOutputChannel('Fast-Sfdc')
  }
  return channel
}

const logger = {
  appendLine (value: string) {
    getChannel()?.appendLine(value)
  },
  clear () {
    getChannel()?.clear()
  },
  show () {
    getChannel()?.show()
  }
}

export default logger

const diagnosticCollection = {
  set (uri: vscode.Uri, values: readonly vscode.Diagnostic[] | undefined) {
    diagnostics?.set(uri, values)
  }
}

const debugDiagnosticCollection = {
  clear () {
    debugDiagnostics?.clear()
  },
  set (uri: vscode.Uri, values: readonly vscode.Diagnostic[] | undefined) {
    debugDiagnostics?.set(uri, values)
  }
}

class Reporter {
  private reporter: TelemetryReporter | undefined

  private initialize () {
    if (this.reporter || !telemetryEnabled) return
    const instrumentationKey = Buffer.from('MWU0ZWZhZGItNWE3Mi00OTQxLWFhNmMtZWY2ZTY5MGNlYjZm', 'base64').toString()
    this.reporter = new TelemetryReporter(`InstrumentationKey=${instrumentationKey}`)
  }

  sendEvent (cmd: string, props = {}, measurements = {}) {
    this.initialize()
    this.reporter?.sendTelemetryEvent(cmd, props, measurements)
  }

  dispose () {
    this.reporter?.dispose()
    this.reporter = undefined
  }
}

const reporter = new Reporter()

const initializeLogger = (ctx: vscode.ExtensionContext) => {
  extensionContext = ctx
  disposed = false
  telemetryEnabled = ctx.extensionMode !== vscode.ExtensionMode.Development && vscode.env.isTelemetryEnabled
  diagnostics = vscode.languages.createDiagnosticCollection('FastSfdc')
  debugDiagnostics = vscode.languages.createDiagnosticCollection('FastSfdc-DebugLog')
  ctx.subscriptions.push({
    dispose () {
      disposed = true
      telemetryEnabled = false
      extensionContext = undefined
      reporter.dispose()
      debugDiagnostics?.dispose()
      debugDiagnostics = undefined
      diagnostics?.dispose()
      diagnostics = undefined
      channel?.dispose()
      channel = undefined
    }
  })
}

export { debugDiagnosticCollection, diagnosticCollection, initializeLogger, reporter }
