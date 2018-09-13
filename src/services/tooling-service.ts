import sfdcConnector from '../sfdc-connector'
import utils from '../utils/utils'
import { MetaObj } from '../fast-sfdc'

const metaContainerName = 'FastSfdc-' + Date.now()
const createMetadataContainer = utils.memoize(sfdcConnector.createMetadataContainer)
const objsInContainer = new Map()

type CompileFn = (objType: string, obj: MetaObj) => Promise<any>

export default {
  requestCompile: async (): Promise<CompileFn> => {
    const metaContainerId = await createMetadataContainer(metaContainerName)
    const compile: CompileFn = async (objType, obj) => {
      const memberKey = obj.FullName + '_' + objType
      const id = await sfdcConnector.upsertObj(objType, {
        ...obj,
        Id: objsInContainer.get(memberKey),
        MetadataContainerId: metaContainerId
      })
      objsInContainer.set(memberKey, id)
      const containerAsyncRequestId = await sfdcConnector.createContainerAsyncRequest(metaContainerId)
      const results = await sfdcConnector.pollDeploymentStatus(containerAsyncRequestId)
      if (results.State === 'Completed') objsInContainer.clear()
      return results
    }
    return compile
  }
}
