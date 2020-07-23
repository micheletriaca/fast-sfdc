import sfdcConnector from '../sfdc-connector'
import { MetaObj } from '../fast-sfdc'
import logger from '../logger'
import * as crypto from 'crypto'
import * as vscode from 'vscode'

const metaContainerName = crypto.createHash('md5').update('FastSfdc-' + vscode.env.machineId).digest('hex')
let metaContainerId: string
const objsInContainer = new Map()

type CompileFn = (objType: string, obj: MetaObj) => Promise<any>

const clearMetadataContainer = async function (toolingType: string, currentMemberKey: string) {
  if (!objsInContainer.has(currentMemberKey) && objsInContainer.size > 0) {
    await Promise.all([...objsInContainer.values()].map(id => sfdcConnector.deleteObj(toolingType, id)))
    objsInContainer.clear()
  }
}

export default {
  requestCompile: async (): Promise<CompileFn> => {
    if (!metaContainerId) await exports.default.resetMetadataContainer()
    let counter = 0

    const compile: CompileFn = async (objType, obj) => {
      const memberKey = obj.FullName + '_' + objType
      try {
        await clearMetadataContainer(objType, memberKey)
        const id = await sfdcConnector.upsertObj(objType, {
          ...obj,
          Id: objsInContainer.get(memberKey),
          MetadataContainerId: metaContainerId
        })
        objsInContainer.set(memberKey, id)
        const containerAsyncRequestId = await sfdcConnector.createContainerAsyncRequest(metaContainerId)
        const results = await sfdcConnector.pollDeploymentStatus(containerAsyncRequestId)
        logger.appendLine(`Status: ${results.State}`)
        if (results.State === 'Completed') objsInContainer.clear()
        return results
      } catch (e) {
        if (++counter < 2) {
          await exports.default.resetMetadataContainer()
          return compile(objType, obj)
        }
      }
    }
    return compile
  },
  resetMetadataContainer: async () => {
    objsInContainer.clear()
    metaContainerId = ''
    metaContainerId = await sfdcConnector.createMetadataContainer(metaContainerName)
  }
}
