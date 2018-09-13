import * as vscode from 'vscode'
import { AnyMetadata, AuraMetadata } from '../fast-sfdc'
import StatusBar from '../statusbar'
import configService from '../services/config-service'
import toolingService from '../services/tooling-service'
import utils from '../utils/utils'
import * as path from 'path'
import * as xml2js from 'xml2js'
import * as fs from 'fs'
import sfdcConnector from '../sfdc-connector'

interface DocType { label: string, toolingType: string, folder: string, extension: string }

async function chooseType (): Promise<DocType | undefined> {
  const res: DocType | undefined = await vscode.window.showQuickPick([
    { label: 'Apex class', toolingType: 'ApexClassMember', folder: 'classes', extension: '.cls' },
    { label: 'Visualforce page', toolingType: 'ApexPageMember', folder: 'pages', extension: '.page' },
    { label: 'Visualforce component', toolingType: 'ApexComponentMember', folder: 'components', extension: '.component' },
    { label: 'Apex trigger', toolingType: 'ApexTriggerMember', folder: 'triggers', extension: '.trigger' },
    { label: 'Lightning component', toolingType: 'AuraDefinitionBundle', folder: 'aura', extension: '.cmp' }
  ], { ignoreFocusOut: true })
  return res
}

function getDocument (metaType: string, metaName: string, objName?: string) {
  switch (metaType) {
    case 'ApexClassMember': return `public class ${metaName} {\n\n}`
    case 'ApexPageMember': return '<apex:page>\nHello world!\n</apex:page>'
    case 'ApexComponentMember': return '<apex:component>\nHello world!\n</apex:component>'
    case 'ApexTriggerMember': return `trigger ${metaName} on ${objName} (before insert) {\n\n}`
    case 'AuraDefinitionBundle': return '<aura:component ' +
      'implements="flexipage:availableForRecordHome,force:hasRecordId" access="global">\n\n\</aura:component>'
    default: return ''
  }
}

function getMetadata (metaType: string, metaName: string, apiVersionS: string): AnyMetadata {
  const apiVersion = parseInt(apiVersionS as string, 10)
  switch (metaType) {
    case 'ApexClassMember':
    case 'ApexTriggerMember':
      return { apiVersion, status: 'Active' }
    case 'ApexPageMember':
      return { apiVersion, availableInTouch: true, confirmationTokenRequired: false, label: metaName }
    case 'ApexComponentMember':
      return { apiVersion, description: metaName, label: metaName }
    case 'AuraDefinitionBundle':
      return { apiVersion, description: metaName }
    default:
      throw Error('unknown meta type')
  }
}

async function createRemoteAuraDefinitionBundle (docBody: string, docMeta: AuraMetadata, docName: string) {
  const auraBundleId = await sfdcConnector.upsertObj('AuraDefinitionBundle', {
    ApiVersion: docMeta.apiVersion,
    Description: docMeta.description,
    DeveloperName: docName,
    MasterLabel: docName
  })
  const auraCmpId = await sfdcConnector.upsertAuraObj({
    Source: docBody,
    AuraDefinitionBundleId: auraBundleId,
    DefType: 'COMPONENT',
    Format: 'XML'
  })
  return auraCmpId
}

async function createRemoteMeta (docBody: string, docMeta: AnyMetadata, docName: string, docType: DocType) {
  const compile = await toolingService.requestCompile()
  const results = await compile(docType.toolingType, {
    Body: docBody,
    FullName: docName,
    Metadata: docMeta
  })
  showErrors(results.DeployDetails.componentFailures)
  return results.State === 'Completed'
}

async function storeOnFileSystem (docBody: string, docMeta: AnyMetadata, docName: string, docType: DocType) {
  const builder = new xml2js.Builder({ xmldec: { version: '1.0', encoding: 'UTF-8' } })
  let p = path.join(vscode.workspace.rootPath as string, 'src', docType.folder, docName + docType.extension)
  if (docType.toolingType === 'AuraDefinitionBundle') {
    const bundleDirPath = path.join(vscode.workspace.rootPath as string, 'src', docType.folder, docName)
    fs.mkdirSync(bundleDirPath)
    p = path.join(bundleDirPath, docName + docType.extension)
  }
  await utils.writeFile(p, docBody)
  await utils.writeFile(`${p}-meta.xml`, builder.buildObject({
    [docType.toolingType.replace(/Member$/, '')]: {
      ...docMeta,
      apiVersion: docMeta.apiVersion + '.0',
      $: { xmlns: 'http://soap.sforce.com/2006/04/metadata' }
    }
  }))
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(p)))
}

function showErrors (errors: any[]) {
  errors
    .filter(e => e.ProblemType !== 'Error')
    .forEach(failure => {
      vscode.window.showErrorMessage(failure)
    })
}

export default async function createMeta () {
  const docType = await chooseType()
  if (!docType) return

  const docName = await utils.inputText(`enter ${docType.label.toLowerCase()} name`)
  if (!docName) return

  const isTrigger = docType.toolingType === 'ApexTriggerMember'
  const sObjectName = isTrigger ? await utils.inputText('enter SObject name') : ''
  if (isTrigger && !sObjectName) return

  const config = await configService.getConfig()
  const docBody = getDocument(docType.toolingType, docName, sObjectName)
  const docMeta = getMetadata(docType.toolingType, docName, config.apiVersion as string)

  StatusBar.startLongJob(async done => {
    switch (docType.toolingType) {
      case 'AuraDefinitionBundle':
        await createRemoteAuraDefinitionBundle(docBody, docMeta as AuraMetadata, docName)
        await storeOnFileSystem(docBody, docMeta, docName, docType)
        done('👍🏻')
        break
      default:
        if (!(await createRemoteMeta(docBody, docMeta, docName, docType))) { done('👎🏻'); return }
        await storeOnFileSystem(docBody, docMeta, docName, docType)
        done('👍🏻')
    }
  })
}
