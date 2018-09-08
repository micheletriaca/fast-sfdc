import * as vscode from 'vscode'
import * as elegantSpinner from 'elegant-spinner'

const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 5)
const MENU_PREFIX = 'FastSfdc'
const spinner = elegantSpinner()
let loadingTimer: NodeJS.Timer | undefined

export default {
  initStatusBar () {
    statusBarItem.text = MENU_PREFIX
    statusBarItem.show()
  },

  startLoading () {
    if (loadingTimer) return
    loadingTimer = setInterval(() => statusBarItem.text = `${MENU_PREFIX}: ${spinner()}`, 50)
  },

  stopLoading () {
    if (!loadingTimer) return
    clearInterval(loadingTimer)
    loadingTimer = undefined
  },

  setStatusText (txt: string | Function) {
    if (typeof txt === 'string') {
      statusBarItem.text = MENU_PREFIX
      if (txt) statusBarItem.text += ': ' + txt
    } else {
      exports.default.startLoading()
      txt((newTxt: string) => {
        exports.default.stopLoading()
        statusBarItem.text = `${MENU_PREFIX}: ${newTxt}`
      })
    }
  }
}
