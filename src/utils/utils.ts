import * as vscode from 'vscode'
import * as fs from 'fs-extra'
import * as xml2js from 'xml2js'
import * as util from 'util'

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
  promisify: util.promisify,
  readFile: fs.readFile,
  writeFile: fs.outputFile,
  readdir: fs.readdir,
  parseXml: (str: xml2js.convertableToString) => util.promisify<xml2js.convertableToString, any>(new xml2js.Parser().parseString)(str), // https://www.npmjs.com/package/xml2js#parsing-multiple-files
  parseXmlStrict: (str: xml2js.convertableToString) => util.promisify<xml2js.convertableToString, any>(new xml2js.Parser({
    explicitArray: false,
    explicitRoot: false,
    valueProcessors: [xml2js.processors.parseBooleans]
  }).parseString)(str),
  buildXml: (str: object, headless = false) => new xml2js.Builder({ headless }).buildObject(str),
  toArray: (x: any, path: string) => x === undefined || x == null ? { [path]: [] } : (Array.isArray(x[path]) ? { [path]: x[path] } : { [path]: [x[path]] }),
  inputText: async (placeHolder: string, defValue = '', opts?: any) => {
    return await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder,
      value: defValue,
      ...opts
    }) || ''
  }
}
