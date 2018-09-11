import * as vscode from 'vscode'
import { DoneCallback, ApexPageMetadata, ApexClassMetadata } from '../fast-sfdc'
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
    { label: 'Lightning component', toolingType: 'ApexClass' }
  ], { ignoreFocusOut: true })
  return res
}

async function getName (metaType: string): Promise<string> {
  return await vscode.window.showInputBox({
    ignoreFocusOut: true,
    placeHolder: `enter ${metaType.toLowerCase()} name`
  }) || ''
}

function getDocument (metaName: string, metaType: string) {
  switch (metaType) {
    case 'ApexClassMember': return `public class ${metaName} {\n  }`
    case 'ApexPageMember': return `<apex:page>\nHello world!\n</apex:page>`
    case 'ApexComponentMember': return `public class ${metaName} {\n  }`
    case 'ApexTriggerMember': return `public class ${metaName} {\n  }`
    default: return ''
  }
}

function getMetadata (metaType: string, metaName: string, apiVersionS: string) {
  const apiVersion = parseInt(apiVersionS as string, 10)
  switch (metaType) {
    case 'ApexClassMember': return {
      apiVersion,
      status: 'Active'
    } as ApexClassMetadata
    case 'ApexPageMember': return {
      apiVersion,
      availableInTouch: true,
      confirmationTokenRequired: false,
      label: metaName
    } as ApexPageMetadata
    default: throw Error('unknown meta type')
  }
}
async function _createMeta (metaName: string, metaType: MetaOption, done: DoneCallback) {
  const config = await configService.getConfig()
  if (!metaContainerId) metaContainerId = await sfdcConnector.createMetadataContainer()
  await sfdcConnector.addObjToMetadataContainer(metaType.toolingType, {
    Body: getDocument(metaName, metaType.toolingType),
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

  StatusBar.startLongJob(async done => {
    try {
      switch (metaType.label) {
        case 'Apex class':
        case 'Visualforce page':
        case 'Visualforce component':
          await _createMeta(metaName, metaType, done)
          return '1'
        case 'Lightning component':
          console.log('2')
          return '2'
      }
    } catch (e) {
      vscode.window.showErrorMessage(JSON.stringify(e))
      done('👎🏻')
    }
  })
}
