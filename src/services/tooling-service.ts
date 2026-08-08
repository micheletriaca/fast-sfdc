import sfdcConnector from '../sfdc-connector'
import { MetaObj } from '../fast-sfdc'
import logger from '../logger'
import * as crypto from 'crypto'
import * as vscode from 'vscode'
import { extractInvalidApexClassNames, extractMissingApexVariables, extractMissingFields, extractMissingRelationships } from '../utils/apex-errors'

const metaContainerName = crypto.createHash('md5').update('FastSfdc-' + vscode.env.machineId).digest('hex')
let metaContainerId: string
const objsInContainer = new Map()

type CompileFn = (objType: string, obj: MetaObj) => Promise<any>

const getCompileFailureMessage = (results: any): string => {
  const componentFailures = results?.DeployDetails?.componentFailures
  const failures = Array.isArray(componentFailures) ? componentFailures : componentFailures ? [componentFailures] : []
  return failures.map(failure => failure.problem || failure.fullName).filter(Boolean).join('\n') ||
    results?.ErrorMsg ||
    `Apex recompilation ended with state ${results?.State || 'unknown'}`
}

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
        throw e
      }
    }
    return compile
  },
  repairApexDependencies: async (error: any, importedClassNames: string[] = []): Promise<boolean> => {
    const invalidClassNames = extractInvalidApexClassNames(error)
    const missingVariables = extractMissingApexVariables(error)
    const missingFields = extractMissingFields(error)
    const missingRelationships = extractMissingRelationships(error)
    if (!invalidClassNames.length && !missingVariables.length && !missingFields.length && !missingRelationships.length) return false

    if (missingVariables.length) {
      logger.appendLine(`Apex compiler reported missing variables: ${missingVariables.join(', ')}`)
    }

    const classNames = [...new Set([...importedClassNames, ...invalidClassNames])]

    const unmanagedClassNames = classNames.filter(name => !name.includes('.'))
    const apexClasses = unmanagedClassNames.length
      ? await sfdcConnector.findApexClassesByNames(unmanagedClassNames)
      : []
    const apexClassesByName = new Map(apexClasses
      .filter(apexClass => !apexClass.NamespacePrefix)
      .map(apexClass => [apexClass.Name, apexClass]))
    const classesToCompile = [...unmanagedClassNames]
      .reverse()
      .map(name => apexClassesByName.get(name))
      .filter((apexClass): apexClass is NonNullable<typeof apexClass> => !!apexClass)

    const describeByEntity = new Map<string, any>()
    const describeEntity = async (entityName: string): Promise<any> => {
      if (!describeByEntity.has(entityName)) {
        describeByEntity.set(entityName, await sfdcConnector.describeSObject(entityName))
      }
      return describeByEntity.get(entityName)
    }

    for (const missingRelationship of missingRelationships) {
      const describe = await describeEntity(missingRelationship.entityName)
      const relationshipIsVisible = (describe.fields || []).some((field: any) => field.relationshipName === missingRelationship.relationshipName)
      logger.appendLine(`Schema visibility: ${missingRelationship.entityName}.${missingRelationship.relationshipName} is ${relationshipIsVisible ? 'visible' : 'not visible'} to the FastSfdc session`)
    }

    for (const missingField of missingFields) {
      const describe = await describeEntity(missingField.entityName)
      const fieldIsVisible = (describe.fields || []).some((field: any) => field.name === missingField.fieldName)
      logger.appendLine(`Schema visibility: ${missingField.entityName}.${missingField.fieldName} is ${fieldIsVisible ? 'visible' : 'not visible'} to the FastSfdc session`)
    }

    if (!classesToCompile.length) return missingFields.length > 0 || missingRelationships.length > 0

    logger.appendLine(`Recompiling invalid Apex dependencies: ${classesToCompile.map(apexClass => apexClass.Name).join(', ')}`)
    await exports.default.resetMetadataContainer()

    try {
      await Promise.all(classesToCompile.map(apexClass => sfdcConnector.createObj('ApexClassMember', {
        Body: apexClass.Body,
        ContentEntityId: apexClass.Id,
        MetadataContainerId: metaContainerId
      })))
      const containerAsyncRequestId = await sfdcConnector.createContainerAsyncRequest(metaContainerId)
      const results = await sfdcConnector.pollDeploymentStatus(containerAsyncRequestId)
      logger.appendLine(`Apex dependency recompilation status: ${results.State}`)
      if (results.State !== 'Completed') throw Error(getCompileFailureMessage(results))

      const recompiledClasses = await sfdcConnector.findApexClassesByNames(classesToCompile.map(apexClass => apexClass.Name))
      logger.appendLine(`Apex validity after recompilation: ${recompiledClasses
        .filter(apexClass => !apexClass.NamespacePrefix)
        .map(apexClass => `${apexClass.Name}=${apexClass.IsValid}`)
        .join(', ')}`)

      const warmupResult = await sfdcConnector.executeAnonymous(classesToCompile
        .map((apexClass, index) => `System.Type fastSfdcType${index} = System.Type.forName('${apexClass.Name}');`)
        .join('\n'))
      const warmupCompiled = warmupResult.compiled === true || warmupResult.compiled === 'true'
      const warmupSucceeded = warmupResult.success === true || warmupResult.success === 'true'
      logger.appendLine(`Apex runtime warmup: compiled=${warmupResult.compiled}, success=${warmupResult.success}`)
      if (!warmupCompiled || !warmupSucceeded) {
        throw Error(warmupResult.compileProblem || warmupResult.exceptionMessage || 'Unable to load recompiled Apex classes')
      }
      return true
    } finally {
      try {
        await exports.default.resetMetadataContainer()
      } catch (cleanupError) {
        objsInContainer.clear()
        metaContainerId = ''
        logger.appendLine(`Unable to reset the metadata container after Apex dependency recompilation: ${cleanupError.message}`)
      }
    }
  },
  resetMetadataContainer: async () => {
    objsInContainer.clear()
    metaContainerId = ''
    metaContainerId = await sfdcConnector.createMetadataContainer(metaContainerName)
  }
}
