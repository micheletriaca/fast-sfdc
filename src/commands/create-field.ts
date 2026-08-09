import utils from '../utils/utils'
import fieldBuilders, { prompt, promptMany } from '../utils/field-builders'
import { buildXml } from 'sfdy/xml-utils'
import sfdcConnector from '../sfdc-connector'
import _ = require('exstream.js')

function xmlArrayWrap (obj: GenericObject) {
  return Object.fromEntries(Object.entries(obj)
    .filter(([, v]: [string, any]) => v !== undefined)
    .map(([k, v]: [string, any]) => [k, Array.isArray(v) ? v + '' : [v + '']])
  )
}

export default async function createField () {
  const files = await utils.untransformAndfetchFiles('profiles/**/*,objects/**/*,permissionsset/**/*', sfdcConnector)

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

  utils.sortedPush(selectedXml.CustomObject.fields, xmlArrayWrap(fieldDefinition), (newEl, el) => el.fullName[0] > newEl.fullName[0])
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
    const retrievedFiles = Object.values(files)
    type RetrievedFile = typeof retrievedFiles[number]
    type ParsedProfile = RetrievedFile & {xml: any; profileName: string}
    filesToStore.push(...await _(retrievedFiles)
      .filter((x: RetrievedFile) => x.fileName.endsWith('.profile'))
      .map(async (x: RetrievedFile): Promise<ParsedProfile> => ({
        ...x,
        xml: await utils.parseXml(x.data),
        profileName: x.fileName.replace(/profiles\/(.*).profile/, '$1')
      }))
      .resolve(100)
      .map((profile: ParsedProfile) => {
        const fieldName = selected.replace(/objects\/(.*).object/, '$1') + '.' + fieldDefinition.fullName
        const fieldPermissions = profile.xml.Profile.fieldPermissions || []
        utils.sortedPush(fieldPermissions, xmlArrayWrap({
          editable: rwProfiles.has(profile.profileName),
          field: fieldName,
          readable: rwProfiles.has(profile.profileName) || readProfiles.has(profile.profileName)
        }), (newEl, el) => el.field[0] > newEl.field)
        profile.xml.Profile.fieldPermissions = fieldPermissions
        return profile
      })
      .map((profile: ParsedProfile) => ({ fileName: profile.fileName, data: Buffer.from(buildXml(profile.xml) + '\n', 'utf8') }))
      .values())
  }

  await utils.transformAndStoreFiles(filesToStore, sfdcConnector)
}
