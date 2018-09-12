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
  promisify: (fn: Function) => {
    return function (...args: any[]): Promise<any> {
      return new Promise((resolve, reject) => {
        fn(...args, (err: any, res: any) => {
          if (err) reject(err)
          else resolve(res)
        })
      })
    }
  },

  inputText: async (placeHolder: string, defValue?: string, opts?: any) => await vscode.window.showInputBox({
    ignoreFocusOut: true,
    placeHolder,
    value: defValue,
    ...opts
  }) || ''
}
