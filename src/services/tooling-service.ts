import sfdcConnector from '../sfdc-connector'
import utils from '../utils/utils'
import { MetaObj } from '../fast-sfdc'

const metaContainerName = 'FastSfdc-' + Date.now()
const createMetadataContainer = utils.memoize(sfdcConnector.createMetadataContainer)
const objsInContainer = new Map()

type CompileFn = (obj: MetaObj, objType: string) => Promise<any>

export default {
  requestCompile: async (): Promise<CompileFn> => {
    const metaContainerId = await createMetadataContainer(metaContainerName)
    const compile: CompileFn = async (obj, objType) => {
      const memberKey = obj.FullName + '_' + objType
      if (objsInContainer.has(memberKey)) {
        await sfdcConnector.editObjInMetadataContainer({ ...obj, Id: objsInContainer.get(memberKey) }, objType)
      } else {
        const id = await sfdcConnector.addObjToMetadataContainer(objType, { ...obj, MetadataContainerId: metaContainerId })
        objsInContainer.set(memberKey, id)
      }
      const containerAsyncRequestId = await sfdcConnector.createContainerAsyncRequest(metaContainerId)
      const results = await sfdcConnector.pollDeploymentStatus(containerAsyncRequestId)
      if (results.State === 'Completed') objsInContainer.clear()
      return results
    }
    return compile
  }
}
