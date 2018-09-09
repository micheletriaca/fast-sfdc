import { Config } from '../fast-sfdc'
import * as SfdcConn from 'node-salesforce-connection'
import * as vscode from 'vscode'
import configService from '../config-service'
import parsers from '../utils/parsers'
import utils from '../utils/utils'

configService.getConfig().then(cfg => config = cfg)
const conn = new SfdcConn()
const getBasePath = () => `/services/data/v${config.apiVersion}/tooling`

const post = async (endpoint: string, body: any): Promise<any> => {
  if (!conn.sessionId) await exports.default.connect()
  return conn.rest(getBasePath() + endpoint, {
    method: 'POST',
    body
  })
}

const patch = async (endpoint: string, body: any): Promise<any> => {
  if (!conn.sessionId) await exports.default.connect()
  return conn.rest(getBasePath() + endpoint, {
    method: 'PATCH',
    body
  })
}

const get = async (endpoint: string) => {
  if (!conn.sessionId) await exports.default.connect()
  return conn.rest(getBasePath() + endpoint)
}

let config: Config

export default {
  connect: async function (cfg: Config | undefined) {
    if (cfg) config = cfg
    await conn.soapLogin({
      hostname: config.url,
      apiVersion: config.apiVersion,
      username: config.username,
      password: config.password
    })
    return true
  },

  async createMetadataContainer (): Promise<string> {
    const res = await post('/sobjects/MetadataContainer/', { name: 'FastSfdc-' + Date.now() })
    return res.id
  },

  async createContainerAsyncRequest (metaContainerId: string): Promise<string> {
    const res = await post('/sobjects/ContainerAsyncRequest/', {
      IsCheckOnly: false,
      IsRunTests: false,
      MetadataContainerId: metaContainerId
    })
    return res.id
  },

  async findByNameAndType (name: string, toolingType: string): Promise<any | null> {
    const res = await exports.default.query(`SELECT
      Id,
      Metadata
      FROM ${toolingType}
      WHERE ${toolingType === 'AuraDefinitionBundle' ? 'Developer' : ''}Name = '${name}'`
    )
    return res && res.records && res.records[0] || null
  },

  async addToMetadataContainer (doc: vscode.TextDocument, record: any, metaContainerId: string): Promise<any> {
    const res = await post(`/sobjects/${parsers.getToolingType(doc, true)}`, {
      Body: doc.getText(),
      ContentEntityId: record.Id,
      Metadata: record.Metadata,
      MetadataContainerId: metaContainerId
    })
    return res.id
  },

  async edit (doc: vscode.TextDocument, record: any, memberId: string) {
    const toolingType = parsers.getToolingType(doc, true)
    await patch(`/sobjects/${toolingType}/${memberId}`, {
      [toolingType === 'AuraDefinition' ? 'Source' : 'Body']: doc.getText(),
      Metadata: record.Metadata
    })
  },

  async pollDeploymentStatus (containerAsyncRequestId: string) {
    let retryCount = 0
    while (true) {
      await utils.sleep(retryCount++ > 3 ? 1000 : 200)
      const res = await exports.default.query(`SELECT
        Id,
        State,
        DeployDetails,
        ErrorMsg
        FROM ContainerAsyncRequest
        WHERE Id='${containerAsyncRequestId}'`
      )
      if (res.records[0].State !== 'Queued') return res.records[0]
    }
  },

  query: (q: string) => get(`/query?q=${encodeURIComponent(q)}`)
}
