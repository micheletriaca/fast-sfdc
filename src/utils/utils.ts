import * as vscode from 'vscode'

export default {
  memoize: (fn: any) => {
    const cache: any = {}
    return async (...args: any[]) => {
      const stringifiedArgs = JSON.stringify(args)
      const result = cache[stringifiedArgs] = cache[stringifiedArgs] || (await fn(...args))
      return result
    }
  },

  sleep: async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  inputText: async (placeHolder: string, defValue?: string, opts?: any) => await vscode.window.showInputBox({
    ignoreFocusOut: true,
    placeHolder,
    value: defValue,
    ...opts
  }) || ''
}
