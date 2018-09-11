import * as vscode from 'vscode'
import { DoneCallback, ApexPageMetadata, ApexClassMetadata, ApexComponentMetadata } from '../fast-sfdc'
import sfdcConnector from '../sfdc-connector'
import StatusBar from '../statusbar'
import configService from '../config-service'

let metaContainerId: string

interface MetaOption {label: string, toolingType: string}

async function chooseType (): Promise<MetaOption | undefined> {
  const res: MetaOption | undefined = await vscode.window.showQuickPick([
    { label: 'Apex class', toolingType: 'ApexClassMember' },
    { label: 'Visualforce page', toolingType: 'ApexPageMember' },
    { label: 'Visualforce component', toolingType: 'ApexComponentMember' },
    { label: 'Apex trigger', toolingType: 'ApexTriggerMember' },
    { label: 'Lightning component', toolingType: 'ApexClassMember' }
  ], { ignoreFocusOut: true })
  return res
}

async function getName (metaType: string): Promise<string> {
  return await vscode.window.showInputBox({
    ignoreFocusOut: true,
    placeHolder: `enter ${metaType.toLowerCase()} name`
  }) || ''
}

async function getObj (): Promise<string> {
  return await vscode.window.showInputBox({
    ignoreFocusOut: true,
    placeHolder: `enter SObject name`
  }) || ''
}

function getDocument (metaName: string, metaType: string, objName?: string) {
  switch (metaType) {
    case 'ApexClassMember': return `public class ${metaName} {\n  }`
    case 'ApexPageMember': return '<apex:page>\nHello world!\n</apex:page>'
    case 'ApexComponentMember': return '<apex:component>\nHello world!\n</apex:component>'
    case 'ApexTriggerMember': return `trigger ${metaName} on ${objName} (before insert) {\n}`
    default: return ''
  }
}

function getMetadata (metaType: string, metaName: string, apiVersionS: string) {
  const apiVersion = parseInt(apiVersionS as string, 10)
  switch (metaType) {
    case 'ApexClassMember':
    case 'ApexTriggerMember':
      return {
        apiVersion,
        status: 'Active'
      } as ApexClassMetadata
    case 'ApexPageMember':
      return {
        apiVersion,
        availableInTouch: true,
        confirmationTokenRequired: false,
        label: metaName
      } as ApexPageMetadata
    case 'ApexComponentMember':
      return {
        apiVersion,
        description: metaName,
        label: metaName
      } as ApexComponentMetadata
    default: throw Error('unknown meta type')
  }
}
async function _createMeta (metaName: string, metaType: MetaOption, objName: string | undefined, done: DoneCallback) {
  const config = await configService.getConfig()
  if (!metaContainerId) metaContainerId = await sfdcConnector.createMetadataContainer()
  await sfdcConnector.addObjToMetadataContainer(metaType.toolingType, {
    Body: getDocument(metaName, metaType.toolingType, objName),
    MetadataContainerId: metaContainerId,
    FullName: metaName,
    Metadata: getMetadata(metaType.toolingType, metaName, config.apiVersion as string)
  })
  const containerAsyncRequestId = await sfdcConnector.createContainerAsyncRequest(metaContainerId)
  const results = await sfdcConnector.pollDeploymentStatus(containerAsyncRequestId)
  if (results.State === 'Completed') {
    done('👍🏻')
  } else {
    showErrors(results.DeployDetails.componentFailures)
    done('👎🏻')
  }
}

function showErrors (errors: any[]) {
  errors
    .filter(e => e.ProblemType !== 'Error')
    .map(failure => {
      vscode.window.showErrorMessage(failure)
    })
}

export default async function createMeta () {
  const metaType = await chooseType()
  if (!metaType) return

  const metaName = await getName(metaType.label)
  if (!metaName) return

  const isTrigger = metaType.toolingType === 'ApexTriggerMember'
  const triggerObj = isTrigger ? await getObj() : ''
  if (isTrigger && !triggerObj) return

  StatusBar.startLongJob(async done => {
    try {
      switch (metaType.toolingType) {
        case 'Lightning component':
          console.log('2')
          return '2'
        default:
          await _createMeta(metaName, metaType, triggerObj, done)
          return '1'
      }
    } catch (e) {
      vscode.window.showErrorMessage(e.message || JSON.stringify(e))
      done('👎🏻')
    }
  })
}
