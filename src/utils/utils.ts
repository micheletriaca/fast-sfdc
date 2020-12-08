import * as vscode from 'vscode'
import * as fs from 'fs-extra'
import * as xml2js from 'xml2js'
import * as util from 'util'
import * as path from 'upath'
import * as transformer from 'sfdy/src/transformer'
import configService from '../services/config-service'
import logger from '../logger'
import * as _ from 'highland'

const getWorkspaceFolder = () => path.toUnix((vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[])[0].uri.fsPath)

const untransformAndfetchFiles = async (fileGlob: string, sfdcConnector: SfdcConnector) => {
  const rootFolder = getWorkspaceFolder()
  const config = configService.getConfigSync()
  const creds = config.credentials[config.currentCredential]
  process.env.environment = creds.environment
  const sfdyConfig = configService.getSfdyConfigSync()

  return Object.fromEntries(await _(Object.entries(await transformer.untransform({
    loginOpts: {
      ...await sfdcConnector.getSession()
    },
    renderers: sfdyConfig.renderers,
    basePath: rootFolder,
    logger: (msg: string) => logger.appendLine(msg),
    files: fileGlob,
    config: sfdyConfig
  })))
    .collect()
    .toPromise(Promise)) as {[fileName: string]: {fileName: string; data: Uint8Array}}
}

const transformAndStoreFiles = async (files: {fileName: string; data: Uint8Array}[], sfdcConnector: SfdcConnector) => {
  const rootFolder = getWorkspaceFolder()
  const config = configService.getConfigSync()
  const creds = config.credentials[config.currentCredential]
  process.env.environment = creds.environment
  const sfdyConfig = configService.getSfdyConfigSync()

  await transformer.transform({
    loginOpts: {
      ...await sfdcConnector.getSession()
    },
    renderers: sfdyConfig.renderers,
    basePath: rootFolder,
    logger: (msg: string) => logger.appendLine(msg),
    files,
    config: sfdyConfig
  })
}

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
  sortedPush: <T>(arr: T[], el: T, compareFn: (newEl: T, el: T) => boolean) => {
    const idx = arr.findIndex(x => compareFn(el, x))
    if (idx !== -1) return arr.splice(idx, 0, el)
    arr.push(el)
  },
  wrapArray: <T> (x: T | T[]): T[] => {
    if (x === null || x === undefined) return []
    if (Array.isArray(x)) return x
    return [x]
  },
  untransformAndfetchFiles,
  transformAndStoreFiles,
  readdir: fs.readdir,
  getWorkspaceFolder,
  parseXml: (str: xml2js.convertableToString) => util.promisify<xml2js.convertableToString, any>(new xml2js.Parser().parseString)(str), // https://www.npmjs.com/package/xml2js#parsing-multiple-files
  parseXmlStrict: <T>(str: xml2js.convertableToString, explicitRoot = false) => util.promisify<xml2js.convertableToString, T>(new xml2js.Parser({
    explicitArray: false,
    explicitRoot,
    valueProcessors: [xml2js.processors.parseBooleans]
  }).parseString)(str),
  buildXml: (str: object, headless = false) => new xml2js.Builder({ headless }).buildObject(str),
  toArray: (x: any, path: string) => x === undefined || x == null ? { [path]: [] } : (Array.isArray(x[path]) ? { [path]: x[path] } : { [path]: [x[path]] }),
  inputText: async (placeHolder: string, defValue = '', opts?: vscode.InputBoxOptions) => {
    return await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder,
      value: defValue,
      ...opts
    }) || ''
  }
}
