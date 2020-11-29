import utils from '../utils/utils'
import * as vscode from 'vscode'
import { buildXml } from 'sfdy/src/utils/xml-utils'
import { prompt, promptMany } from '../utils/field-builders'
import * as path from 'upath'
import * as fs from 'fs'
import sfdcConnector from '../sfdc-connector'

interface XmlField {fullName: string; label?: string; required: boolean; formula: string; type: 'AutoNumber' | 'Summary'}
interface XmlFls {editable: boolean; field: string; readable: boolean}
interface XmlProfile {
  [key: string]: {
    fieldPermissions: XmlFls[];
  };
}
interface XmlCustomObject {
  CustomObject: {
    fields: XmlField[];
  };
}

const standardWeirdFields = new Set([
  'OwnerId',
  'CreatedById',
  'LastModifiedById',
  'CurrencyIsoCode',
  'RecordTypeId',
  'CreatedDate',
  'LastModifiedDate',
  'Name',
  'IsPartner',
  'IsCustomerPortal',
  'PersonEmail',
  'PersonTitle',
  'PersonBirthdate',
  'PersonDoNotCall',
  'PersonHomePhone',
  'PersonDepartment',
  'PersonLeadSource',
  'PersonOtherPhone',
  'PersonMobilePhone',
  'PersonIndividualId',
  'PersonOtherAddress',
  'PersonAssistantName',
  'PersonAssistantPhone',
  'PersonMailingAddress',
  'PersonHasOptedOutOfFax',
  'PersonLastCUUpdateDate',
  'PersonLastCURequestDate',
  'PersonHasOptedOutOfEmail'
])

export default async function editFlsProfile (document: vscode.TextDocument) {
  const rootFolder = utils.getWorkspaceFolder()
  const fPath = document.fileName.replace(rootFolder, '')

  const objects = fs.readdirSync(path.join(rootFolder, 'src', 'objects'))
    .filter(x => !x.endsWith('__mdt.object'))
    .filter(x => !x.endsWith('__e.object'))
    .filter(x => x.endsWith('.object') && ['objects/PersonAccount.object', 'objects/Event.object', 'objects/Task.object'].indexOf(x) === -1)
    .map(x => ({ label: x.replace(/(.*).object/, '$1') }))

  const selectedObjectName = await prompt('Select the object', undefined, objects)()
  if (!selectedObjectName) return

  const files = await utils.untransformAndfetchFiles(`${fPath},objects/${selectedObjectName}.object`, sfdcConnector)
  const selectedObjectXml = await utils.parseXmlStrict(files[`objects/${selectedObjectName}.object`].data, true) as XmlCustomObject
  selectedObjectXml.CustomObject.fields = utils.wrapArray(selectedObjectXml.CustomObject.fields)

  const profileXml = await utils.parseXmlStrict(files[fPath.replace('/src/', '')].data, true) as XmlProfile
  const flsList = utils.wrapArray(Object.values(profileXml)[0].fieldPermissions)

  // Existing FLS config from selected profile
  const profileFlsMap = Object.fromEntries(flsList
    .filter(x => x.field.startsWith(selectedObjectName + '.'))
    .map(x => ({ ...x, field: x.field.replace(selectedObjectName + '.', '') }))
    .map(x => [x.field, x]))

  // Object fields from CustomObject
  const objectFields = (selectedObjectXml.CustomObject.fields as XmlField[])
    .map(x => ({
      label: (x.label && x.label) || x.fullName,
      apiName: x.fullName,
      hasFls: !x.required && !standardWeirdFields.has(x.fullName),
      isReadonly: x.formula || x.type === 'AutoNumber' || x.type === 'Summary',
      isInProfile: !!profileFlsMap[x.fullName],
      ...{ editable: false, readable: false },
      ...profileFlsMap[x.fullName]
    }))
    .filter(x => x.hasFls)

  // Editing Read-Write FLS
  const flsRw = objectFields.filter(x => !x.isReadonly).map(x => ({
    label: x.apiName,
    detail: x.label + (!x.isInProfile ? ' - ACTUALLY NOT IN PROFILE! 🤨' : ''),
    picked: x.editable
  }))

  const flsRwFinal = await promptMany('Configure Read-Write FLS', flsRw, {}, false)()
  if (!flsRwFinal) return
  const flsRwFinalSet = new Set(flsRwFinal)

  objectFields.forEach(x => (x.editable = flsRwFinalSet.has(x.apiName)))

  // Editing Read FLS - Filtering out selected read-write fields, because they're already readable
  const flsR = objectFields
    .filter(x => !x.editable)
    .map(x => ({
      label: x.apiName,
      detail: x.label + (!x.isInProfile ? ' - ACTUALLY NOT IN PROFILE! 🤨' : ''),
      picked: x.readable
    }))

  const flsRFinal = await promptMany('Configure Read FLS', flsR, {}, false)()
  if (!flsRFinal) return
  const flsRFinalSet = new Set(flsRFinal)

  objectFields.forEach(x => (x.readable = flsRFinalSet.has(x.apiName) || x.editable))

  // Patching FLS
  const objFieldsMap = Object.fromEntries(objectFields.map(x => [selectedObjectName + '.' + x.apiName, x]))
  flsList.forEach(x => {
    if (x.field.startsWith(selectedObjectName + '.')) {
      x.readable = objFieldsMap[x.field].readable
      x.editable = objFieldsMap[x.field].editable
    }
  })

  Object.values(objFieldsMap).filter(x => !x.isInProfile).forEach(x => {
    utils.sortedPush(flsList, {
      editable: x.editable,
      field: selectedObjectName + '.' + x.apiName,
      readable: x.readable
    }, (newEl, el) => el.field > newEl.field)
  })

  // Saving
  Object.values(profileXml)[0].fieldPermissions = flsList
  await utils.transformAndStoreFiles([{ fileName: fPath.replace('/src/', ''), data: Buffer.from(buildXml(profileXml) + '\n', 'utf8') }], sfdcConnector)

  const res = await prompt('Deploy?', undefined, [{ label: 'Yes', value: true }, { label: 'No', value: false }])()
  if (res) vscode.commands.executeCommand('FastSfdc.deploySelected', document.uri)
}
