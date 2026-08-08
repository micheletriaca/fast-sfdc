import * as vscode from 'vscode'
import { AnyObj, DoneCallback } from '../fast-sfdc'
import configService from '../services/config-service'

let sbItem: vscode.StatusBarItem | undefined
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
        statusBar.stopLoading()
        if (!loadingCounter) statusBar.setText(newTxt)
        runNextJob()
      })
    } catch (e) {
      vscode.window.showErrorMessage(e.message || JSON.stringify(e))
      statusBar.stopLoading()
      if (!loadingCounter) statusBar.setText('👎🏻')
      runNextJob()
    }
  } else {
    running = false
  }
}

const statusBar = {
  initialize (ctx: vscode.ExtensionContext) {
    if (sbItem) return
    sbItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 5)
    sbItem.command = 'FastSfdc.statusBarClick'
    ctx.subscriptions.push({
      dispose () {
        clearTimeout(doneTimeout)
        sbItem?.dispose()
        sbItem = undefined
        loadingCounter = 0
        queue = []
        running = false
      }
    })
  },

  initStatusBar () {
    if (!sbItem) return
    sbItem.text = MENU_PREFIX()
    sbItem.show()
  },

  hideStatusBar () {
    sbItem?.hide()
  },

  startLoading () {
    clearTimeout(doneTimeout)
    loadingCounter++
    this.setText()
  },

  stopLoading () {
    loadingCounter = Math.max(loadingCounter - 1, 0)
    if (loadingCounter === 0) {
      if (!sbItem) return
      sbItem.text = MENU_PREFIX()
      doneTimeout = setTimeout(() => {
        if (sbItem) sbItem.text = MENU_PREFIX()
      }, 10000)
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
      for (let i = 0; i < abortedJobs; i++) statusBar.stopLoading()
    }
    statusBar.startLoading()
    queue.push(_doLongJob)
    if (!running) runNextJob()
  },

  setText (newTxt: string | undefined = undefined) {
    if (!sbItem) return
    if (newTxt === undefined) sbItem.text = `${MENU_PREFIX()} $(sync~spin)${loadingCounter > 1 ? ' (' + loadingCounter + ')' : ''}`
    else sbItem.text = `${MENU_PREFIX()} ${newTxt || ''}`
  }
}

export default statusBar
