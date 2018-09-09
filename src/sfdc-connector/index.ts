import { Config } from '../fast-sfdc'
import * as SfdcConn from 'node-salesforce-connection'
import * as vscode from 'vscode'
import configService from '../config-service'
import parsers from '../utils/parsers'
import utils from '../utils/utils'

let config: Config
configService.getConfig().then(cfg => config = cfg)
const conn = new SfdcConn()

const getBasePath = () => `/services/data/v${config.apiVersion}/tooling`
const rest = async function (endpoint: string, ...args: any[]) {
  try {
    if (!conn.sessionId) await connect()
    return await conn.rest(getBasePath() + endpoint, ...args)
  } catch (e) {
    if (e.response.statusCode === 401 || e.response.statusCode === 403) {
      await connect()
      return conn.rest(getBasePath() + endpoint, ...args)
    } else {
      throw e
    }
  }
}

const post = async (endpoint: string, body: any) => rest(endpoint, { method: 'POST', body })
const patch = async (endpoint: string, body: any) => rest(endpoint, { method: 'PATCH', body })
const get = async (endpoint: string) => rest(endpoint)
const query = (q: string) => get(`/query?q=${encodeURIComponent(q.replace(/ +/g, ' '))}`)
const connect = async function (cfg?: Config) {
  if (cfg) config = cfg
  await conn.soapLogin({
    hostname: config.url,
    apiVersion: config.apiVersion,
    username: config.username,
    password: config.password
  })
}

export default {
  connect,
  query,

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
    const res = await query(`SELECT
      Id,
      Metadata
      FROM ${toolingType}
      WHERE ${toolingType === 'AuraDefinitionBundle' ? 'Developer' : ''}Name = '${name}'`
    )
    return res.records[0] || null
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
      const res = await query(`SELECT
        Id,
        State,
        DeployDetails,
        ErrorMsg
        FROM ContainerAsyncRequest
        WHERE Id = '${containerAsyncRequestId}'`
      )
      if (res.records[0].State !== 'Queued') return res.records[0]
    }
  }
}
