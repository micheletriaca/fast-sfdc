import * as vscode from 'vscode'
import { DoneCallback, ApexPageMetadata, ApexClassMetadata, ApexComponentMetadata } from '../fast-sfdc'
import StatusBar from '../statusbar'
import configService from '../services/config-service'
import toolingService from '../services/tooling-service'
import utils from '../utils/utils'

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
async function _createMeta (metaName: string, metaType: MetaOption, objName: string, done: DoneCallback) {
  const config = await configService.getConfig()
  const compile = await toolingService.requestCompile()
  const results = await compile({
    Body: getDocument(metaName, metaType.toolingType, objName),
    FullName: metaName,
    Metadata: getMetadata(metaType.toolingType, metaName, config.apiVersion as string)
  }, metaType.toolingType)
  showErrors(results.DeployDetails.componentFailures)
  done(results.State === 'Completed' ? '👍🏻' : '👎🏻')
}

function showErrors (errors: any[]) {
  errors
    .filter(e => e.ProblemType !== 'Error')
    .forEach(failure => {
      vscode.window.showErrorMessage(failure)
    })
}

export default async function createMeta () {
  const metaType = await chooseType()
  if (!metaType) return

  const metaName = await utils.inputText(`enter ${metaType.label.toLowerCase()} name`)
  if (!metaName) return

  const isTrigger = metaType.toolingType === 'ApexTriggerMember'
  const triggerObj = isTrigger ? await utils.inputText('enter SObject name') : ''
  if (isTrigger && !triggerObj) return

  StatusBar.startLongJob(async done => {
    switch (metaType.toolingType) {
      case 'Lightning component': return '2'
      default: return _createMeta(metaName, metaType, triggerObj, done)
    }
  })
}
