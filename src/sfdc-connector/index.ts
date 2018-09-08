import { Config } from '../fast-sfdc'
import * as SfdcConn from 'node-salesforce-connection'
import * as vscode from 'vscode'

const conn = new SfdcConn()
const apiVersion = '43.0'

export default {
  connect: async function (config: Config) {
    await conn.soapLogin({
      hostname: config.url,
      apiVersion: config.apiVersion,
      username: config.username,
      password: config.password
    })
    return true
  },

  saveClass: async function (document: vscode.TextDocument, context: vscode.ExtensionContext) {
    conn.rest(`/services/data/${apiVersion}/`)
  }
}
