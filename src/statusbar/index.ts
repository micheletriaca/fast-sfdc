import * as vscode from 'vscode'
import { DoneCallback } from '../fast-sfdc'
import configService from '../services/config-service'

const sbItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 5)
sbItem.command = 'FastSfdc.manageCredentials'
const MENU_PREFIX = () => {
  const cfg = configService.getConfigSync()
  return `fast-sfdc - ${cfg.stored ? cfg.credentials[cfg.currentCredential].username : 'not logged in'}`
}

let loadingCounter = 0
let doneTimeout: NodeJS.Timer

const queue: Function[] = []
let running = false

const runNextJob = () => {
  const f = queue.shift()
  if (f) {
    running = true
    try {
      f((newTxt: string) => {
        exports.default.stopLoading()
        if (!loadingCounter) exports.default.setText(newTxt)
        runNextJob()
      })
    } catch (e) {
      vscode.window.showErrorMessage(e.message || JSON.stringify(e))
      exports.default.stopLoading()
      if (!loadingCounter) exports.default.setText('👎🏻')
      runNextJob()
    }
  } else {
    running = false
  }
}

export default {
  initStatusBar () {
    sbItem.text = MENU_PREFIX()
    sbItem.show()
  },

  hideStatusBar () {
    sbItem.hide()
  },

  startLoading () {
    clearTimeout(doneTimeout)
    loadingCounter++
    this.setText()
  },

  stopLoading () {
    loadingCounter = Math.max(loadingCounter - 1, 0)
    if (loadingCounter === 0) {
      sbItem.text = MENU_PREFIX()
      doneTimeout = setTimeout(() => (sbItem.text = MENU_PREFIX()), 10000)
    } else {
      this.setText()
    }
  },

  startLongJob (doLongJob: (done: DoneCallback) => void) {
    exports.default.startLoading()
    queue.push(doLongJob)
    if (!running) runNextJob()
  },

  setText (newTxt: string | undefined = undefined) {
    if (!newTxt) sbItem.text = `${MENU_PREFIX()} $(sync~spin)${loadingCounter > 1 ? ' (' + loadingCounter + ')' : ''}`
    else sbItem.text = `${MENU_PREFIX()} ${newTxt || ''}`
  }
}
