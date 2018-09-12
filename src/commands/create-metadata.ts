import * as vscode from 'vscode'
import { AnyMetadata } from '../fast-sfdc'
import StatusBar from '../statusbar'
import configService from '../services/config-service'
import toolingService from '../services/tooling-service'
import utils from '../utils/utils'
import * as path from 'path'
import * as xml2js from 'xml2js'

interface DocType { label: string, toolingType: string, folder: string, extension: string }

async function chooseType (): Promise<DocType | undefined> {
  const res: DocType | undefined = await vscode.window.showQuickPick([
    { label: 'Apex class', toolingType: 'ApexClassMember', folder: 'classes', extension: '.cls' },
    { label: 'Visualforce page', toolingType: 'ApexPageMember', folder: 'pages', extension: '.page' },
    { label: 'Visualforce component', toolingType: 'ApexComponentMember', folder: 'components', extension: '.component' },
    { label: 'Apex trigger', toolingType: 'ApexTriggerMember', folder: 'triggers', extension: '.trigger' },
    { label: 'Lightning component', toolingType: 'ApexClassMember', folder: '', extension: '' }
  ], { ignoreFocusOut: true })
  return res
}

function getDocument (metaType: string, metaName: string, objName?: string) {
  switch (metaType) {
    case 'ApexClassMember': return `public class ${metaName} {\n\n}`
    case 'ApexPageMember': return '<apex:page>\nHello world!\n</apex:page>'
    case 'ApexComponentMember': return '<apex:component>\nHello world!\n</apex:component>'
    case 'ApexTriggerMember': return `trigger ${metaName} on ${objName} (before insert) {\n\n}`
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
    default:
      throw Error('unknown meta type')
  }
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
  const p = path.join(vscode.workspace.rootPath as string, 'src', docType.folder, docName + docType.extension)
  await utils.writeFile(p, docBody)
  await utils.writeFile(`${p}-meta.xml`, builder.buildObject({
    ApexClass: {
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
      case 'Lightning component': return '2'
      default:
        let goOn = await createRemoteMeta(docBody, docMeta, docName, docType)
        if (!goOn) { done('👎🏻'); return }
        await storeOnFileSystem(docBody, docMeta, docName, docType)
        done('👍🏻')
    }
  })
}
