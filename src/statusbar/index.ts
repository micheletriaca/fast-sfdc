import * as vscode from 'vscode'
import * as elegantSpinner from 'elegant-spinner'
import { DoneCallback } from '../fast-sfdc'
import configService from '../services/config-service'

const sbItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 5)
const MENU_PREFIX = () => {
  const cfg = configService.getConfigSync()
  return cfg.stored ? `FastSfdc - ${cfg.credentials[cfg.currentCredential].username}` : 'FastSfdc - not logged in'
}

const spinner = elegantSpinner()

let loadingTimer: NodeJS.Timer
let loadingCounter = 0

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
    if (!loadingCounter++) loadingTimer = setInterval(() => (sbItem.text = `${MENU_PREFIX()}: ${spinner()}${loadingCounter > 1 ? ' (' + loadingCounter + ')' : ''}`), 50)
  },

  stopLoading () {
    if (loadingCounter === 1) {
      sbItem.text = MENU_PREFIX()
      clearInterval(loadingTimer)
    }
    loadingCounter = Math.max(loadingCounter - 1, 0)
  },

  startLongJob (doLongJob: (done: DoneCallback) => void) {
    exports.default.startLoading()
    queue.push(doLongJob)
    if (!running) runNextJob()
  },

  setText (newTxt: string) {
    sbItem.text = `${MENU_PREFIX()}${(newTxt && ': ' + newTxt) || ''}`
  }
}
