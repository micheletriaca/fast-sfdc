import * as vscode from 'vscode'
import StatusBar from '../statusbar'

export default async function compile (doc: vscode.TextDocument) {
  StatusBar.setStatusText((done: Function) => {
    setTimeout(() => {
      console.log('compile called')
      done('🌶')
    }, 2000)
  })
}
