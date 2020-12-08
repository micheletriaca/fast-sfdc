import utils from '../utils/utils'
import * as vscode from 'vscode'
import { buildXml } from 'sfdy/src/utils/xml-utils'
import { prompt, promptMany } from '../utils/field-builders'
import * as path from 'upath'
import * as fs from 'fs'
import sfdcConnector from '../sfdc-connector'
import configService from '../services/config-service'
import { XmlProfile, XmlField, XmlCustomObject } from '../fast-sfdc'

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
  const profilePath = document.fileName.replace(rootFolder, '')
  const sfdyCfg = configService.getSfdyConfigSync()

  const objects = fs.readdirSync(path.join(rootFolder, 'src', 'objects'))
    .filter(x => x.endsWith('.object'))
    .filter(x => !x.endsWith('__mdt.object') && !x.endsWith('__e.object'))
    .filter(x => !['objects/PersonAccount.object', 'objects/Event.object', 'objects/Task.object'].includes(x))
    .map(x => ({ label: x.replace(/(.*).object/, '$1') }))

  const selectedObjectName = await prompt('Select the object', undefined, objects)() as string
  if (!selectedObjectName) return

  const selObjPath = `objects/${selectedObjectName}.object`
  const files = await utils.untransformAndfetchFiles(`${profilePath},${selObjPath}`, sfdcConnector)
  const selectedObjectXml = await utils.parseXmlStrict<XmlCustomObject>(files[selObjPath].data, true)
  if (selectedObjectXml.CustomObject.customSettingsType) {
    return vscode.window.showErrorMessage('The selected object is a custom setting. FLS not available')
  }

  selectedObjectXml.CustomObject.fields = utils.wrapArray(selectedObjectXml.CustomObject.fields)

  const profileXml = await utils.parseXmlStrict<XmlProfile>(files[profilePath.replace('/src/', '')].data, true)
  const flsList = utils.wrapArray(Object.values(profileXml)[0].fieldPermissions)

  if (sfdyCfg.profiles?.addDisabledVersionedObjects && profileXml.Profile) {
    const objInProfile = utils.wrapArray(profileXml.Profile.objectPermissions).find(x => x.object === selectedObjectName)
    if (objInProfile && !Object.entries(objInProfile)
      .filter(([k]) => k !== 'object')
      .reduce((res, [, v]) => v || res, false)
    ) {
      return vscode.window.showErrorMessage('The selected object has been disabled for this profile. FLS not available')
    }
  }

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

  Object.values(profileXml)[0].fieldPermissions = flsList

  // Reapplying standard patches
  if (sfdyCfg.permissionSets?.stripUselessFls && profileXml.PermissionSet) {
    Object.values(profileXml)[0].fieldPermissions = flsList.filter(x => x.editable || x.readable)
  }

  // Saving
  await utils.transformAndStoreFiles([{
    fileName: profilePath.replace('/src/', ''),
    data: Buffer.from(buildXml(profileXml) + '\n', 'utf8')
  }], sfdcConnector)

  const res = await prompt('Deploy?', undefined, [{ label: 'Yes', value: true }, { label: 'No', value: false }])()
  if (res) vscode.commands.executeCommand('FastSfdc.deploySelected', document.uri)
}
