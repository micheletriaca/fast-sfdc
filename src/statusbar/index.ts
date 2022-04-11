import * as vscode from 'vscode'
import { AnyObj, DoneCallback } from '../fast-sfdc'
import configService from '../services/config-service'

const sbItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 5)
sbItem.command = 'FastSfdc.statusBarClick'
const MENU_PREFIX = () => {
  const cfg = configService.getConfigSync()
  return `fast-sfdc - ${cfg.stored ? cfg.credentials[cfg.currentCredential].username : 'not logged in'}`
}

let loadingCounter = 0
let doneTimeout: NodeJS.Timer

// eslint-disable-next-line @typescript-eslint/ban-types
let queue: Function[] = []
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

  startLongJob (doLongJob: (done: DoneCallback) => void, key?: string, abortPreviousJobs = false) {
    const _doLongJob = (done: DoneCallback) => doLongJob(done)
    _doLongJob.key = key
    if (abortPreviousJobs && key) {
      const size = queue.length
      queue = queue.filter((x: AnyObj) => x.key !== key)
      const abortedJobs = size - queue.length
      for (let i = 0; i < abortedJobs; i++) exports.default.stopLoading()
    }
    exports.default.startLoading()
    queue.push(_doLongJob)
    if (!running) runNextJob()
  },

  setText (newTxt: string | undefined = undefined) {
    if (!newTxt) sbItem.text = `${MENU_PREFIX()} $(sync~spin)${loadingCounter > 1 ? ' (' + loadingCounter + ')' : ''}`
    else sbItem.text = `${MENU_PREFIX()} ${newTxt || ''}`
  }
}
