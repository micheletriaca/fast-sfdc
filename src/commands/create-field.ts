import * as transformer from 'sfdy/src/transformer'
import configService from '../services/config-service'
import logger from '../logger'
import utils from '../utils/utils'
import * as _ from 'highland'
import fieldBuilders, { prompt, promptMany } from '../utils/field-builders'
import { buildXml } from 'sfdy/src/utils/xml-utils'
import sfdcConnector from '../sfdc-connector'

async function untransformAndfetchFiles (fileGlob: string) {
  const rootFolder = utils.getWorkspaceFolder()
  const config = configService.getConfigSync()
  const creds = config.credentials[config.currentCredential]
  process.env.environment = creds.environment
  const sfdyConfig = configService.getSfdyConfigSync()

  return Object.fromEntries(await _(Object.entries(await transformer.untransform({
    loginOpts: {
      ...await sfdcConnector.getSession()
    },
    renderers: sfdyConfig.renderers,
    basePath: rootFolder,
    logger: (msg: string) => logger.appendLine(msg),
    files: fileGlob,
    config: sfdyConfig
  })))
    .collect()
    .toPromise(Promise)) as {[fileName: string]: {fileName: string; data: Uint8Array}}
}

async function transformAndStoreFiles (files: {fileName: string; data: Uint8Array}[]) {
  const rootFolder = utils.getWorkspaceFolder()
  const config = configService.getConfigSync()
  const creds = config.credentials[config.currentCredential]
  process.env.environment = creds.environment
  const sfdyConfig = configService.getSfdyConfigSync()

  await transformer.transform({
    loginOpts: {
      ...await sfdcConnector.getSession()
    },
    renderers: sfdyConfig.renderers,
    basePath: rootFolder,
    logger: (msg: string) => logger.appendLine(msg),
    files,
    config: sfdyConfig
  })
}

function sortedPush (
  arr: GenericObject[],
  el: GenericObject,
  compareFn: (newEl: GenericObject, el: GenericObject) => boolean
) {
  const idx = arr.findIndex(x => compareFn(el, x))
  if (idx !== -1) return arr.splice(idx, 0, el)
  arr.push(el)
}

function xmlArrayWrap (obj: GenericObject) {
  return Object.fromEntries(Object.entries(obj)
    .filter(([, v]: [string, any]) => v !== undefined)
    .map(([k, v]: [string, any]) => [k, Array.isArray(v) ? v + '' : [v + '']])
  )
}

export default async function createField () {
  const files = await untransformAndfetchFiles('profiles/**/*,objects/**/*,permissionsset/**/*')

  const objects = Object.keys(files)
    .filter(x => !x.endsWith('__mdt.object'))
    .filter(x => !x.endsWith('__e.object'))
    .filter(x => x.endsWith('.object') && ['objects/PersonAccount.object', 'objects/Event.object', 'objects/Task.object'].indexOf(x) === -1)
    .map(x => ({ label: x.replace(/objects\/(.*).object/, '$1'), value: x }))

  const selected = await prompt('Select the object', undefined, objects)()
  if (!selected) return

  const selectedXml = await utils.parseXml(files[selected].data)
  selectedXml.CustomObject.fields = selectedXml.CustomObject.fields || []
  const trackHistory = !!selectedXml.CustomObject.enableHistory && selectedXml.CustomObject.enableHistory[0] === 'true'
  const allFields = selectedXml.CustomObject.fields.map((x: {fullName: string}) => x.fullName[0])

  const fieldType = await prompt('Select a Field Type', undefined, [
    { label: 'Auto Number', value: 'AutoNumber' },
    { label: 'Lookup Relationship', value: 'Lookup' },
    { label: 'Checkbox', value: 'Checkbox' },
    { label: 'Currency', value: 'Currency' },
    { label: 'Date', value: 'Date' },
    { label: 'Date/Time', value: 'DateTime' },
    { label: 'Email', value: 'Email' },
    { label: 'Number', value: 'Number' },
    { label: 'Percent', value: 'Percent' },
    { label: 'Phone', value: 'Phone' },
    { label: 'Text', value: 'Text' },
    { label: 'Text Area', value: 'TextArea' },
    { label: 'Text Area (Long)', value: 'LongTextArea' },
    { label: 'Text Area (Rich)', value: 'RichTextArea' }
    // Picklist = 'Picklist',
    // MultiselectPicklist = 'MultiselectPicklist',
    // Summary = 'Summary',
  ])()
  if (!fieldType) return

  const fieldDefinition = await fieldBuilders(fieldType, allFields, trackHistory, objects.map(x => ({ label: x.label, value: x.label })))
  if (!fieldDefinition) return

  sortedPush(selectedXml.CustomObject.fields, xmlArrayWrap(fieldDefinition), (newEl, el) => el.fullName[0] > newEl.fullName[0])
  files[selected].data = Buffer.from(buildXml(selectedXml) + '\n', 'utf8')

  const filesToStore = [files[selected]]

  if (!fieldDefinition.required) {
    const profileNames = Object.keys(files)
      .filter(x => x.endsWith('.profile'))
      .map(x => ({ label: x.replace(/profiles\/(.*).profile/, '$1'), fileName: x }))

    const rwProfiles = new Set(await promptMany('Apply Read-Write FLS on profiles', profileNames)())
    const rProfileOptions = profileNames.filter(x => !rwProfiles.has(x.label))
    const minimumFlsIsRead = fieldDefinition.type === 'AutoNumber'
    const readProfiles = (
      minimumFlsIsRead
        ? new Set(rProfileOptions.map(x => x.label))
        : new Set(rProfileOptions.length ? await promptMany('Apply Read FLS on profiles', rProfileOptions)() : [])
    )
    filesToStore.push(...await _(Object.values(files))
      .filter(x => x.fileName.endsWith('.profile'))
      .map(async x => ({ ...x, xml: await utils.parseXml(x.data), profileName: x.fileName.replace(/profiles\/(.*).profile/, '$1') }))
      .map(x => _(x))
      .parallel(100)
      .map(x => {
        const fieldName = selected.replace(/objects\/(.*).object/, '$1') + '.' + fieldDefinition.fullName
        const fieldPermissions = x.xml!.Profile.fieldPermissions || []
        sortedPush(fieldPermissions, xmlArrayWrap({
          editable: rwProfiles.has(x.profileName),
          field: fieldName,
          readable: rwProfiles.has(x.profileName) || readProfiles.has(x.profileName)
        }), (newEl, el) => el.field[0] > newEl.field)
        x.xml!.Profile.fieldPermissions = fieldPermissions
        return x
      })
      .map(x => ({ fileName: x.fileName, data: Buffer.from(buildXml(x.xml!) + '\n', 'utf8') }))
      .collect()
      .toPromise(Promise))
  }

  await transformAndStoreFiles(filesToStore)
}
