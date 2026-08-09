import logger, { reporter } from '../logger'
import { getMetadataComponentAliases } from '../services/metadata-component-aliases'
import _ = require('exstream.js')

const asArray = <T>(value: T | T[] | undefined): T[] =>
  Array.isArray(value) ? value : value ? [value] : []

export default async function fetch (sfdc: SfdcConnector, supportedChildTypes: string[] = []) {
  logger.appendLine('Fetching org metadata...')
  reporter.sendEvent('sfdcExplorer')
  const FOLDERED_METAS = ['Report', 'Dashboard', 'EmailTemplate', 'Document']
  const FOLDER_TYPES: {[type: string]: string} = {
    Report: 'ReportFolder',
    Dashboard: 'DashboardFolder',
    EmailTemplate: 'EmailFolder',
    Document: 'DocumentFolder'
  }

  const personRecordTypesRequest = supportedChildTypes.includes('RecordType')
    ? sfdc.query(`SELECT DeveloperName, NamespacePrefix, SobjectType, IsPersonType
      FROM RecordType
      WHERE IsPersonType = true`, true).catch((error: any) => {
      if (!String(error?.message || error).includes('INVALID_FIELD')) throw error
      logger.appendLine('Person Accounts are not available in this org; skipping their RecordType aliases.')
      return { records: [] }
    })
    : Promise.resolve({ records: [] })
  const [allFolders, metadataDescription, personRecordTypes] = await Promise.all([
    sfdc.query('SELECT Id, ParentId, NamespacePrefix, DeveloperName, Type FROM Folder WHERE DeveloperName != null', true),
    sfdc.describeMetadata(),
    personRecordTypesRequest
  ])
  const componentAliases = getMetadataComponentAliases(personRecordTypes.records || [])
  allFolders.records.forEach((x: any) => { if (x.NamespacePrefix) x.DeveloperName = x.NamespacePrefix + '__' + x.DeveloperName })
  allFolders.records.forEach((x: any) => (x.Type = x.Type === 'Email' ? 'EmailTemplate' : x.Type))
  allFolders.records.push({ DeveloperName: 'unfiled$public', Type: 'EmailTemplate', Id: 'publicEmail', ParentId: '' })
  allFolders.records.push({ DeveloperName: 'unfiled$public', Type: 'Document', Id: 'publicDocs', ParentId: '' })
  allFolders.records.push({ DeveloperName: 'unfiled$public', Type: 'Report', Id: 'publicReports', ParentId: '' })
  allFolders.records.push({ DeveloperName: 'unfiled$public', Type: 'Dashboard', Id: 'publicDashboards', ParentId: '' })

  const fMap = {
    ..._(allFolders.records).filter((x: {Type: string}) => FOLDERED_METAS.includes(x.Type)).keyBy((x: {Type: string; DeveloperName: string}) => x.Type + '/' + x.DeveloperName).value(),
    ..._(allFolders.records).filter((x: {Type: string }) => FOLDERED_METAS.includes(x.Type)).keyBy('Id').value()
  }

  const joinFolders = (type: string, devName: string) => {
    const res = []
    let current = type + '/' + devName
    while (fMap[current]) {
      res.unshift(fMap[current].DeveloperName)
      current = type + '/' + (fMap[current].ParentId && fMap[fMap[current].ParentId] && fMap[fMap[current].ParentId].DeveloperName)
    }
    return res.join('/')
  }

  const appendAllFoldersToFilename = (x: {fileName: string; fullName: string; type: string}) => {
    const idx1 = x.fileName.indexOf('/')
    const idx2 = x.fileName.lastIndexOf('/')
    if (idx1 === idx2) return x
    const fName = x.fileName.substring(idx1 + 1, idx2)
    x.fullName = x.fullName.replace(fName, joinFolders(x.type, fName))
    return x
  }

  const appendAllFoldersToFolder = (x: {Type: string; DeveloperName: string}) => {
    const joinedFolders = joinFolders(x.Type, x.DeveloperName)
    const folderType = FOLDER_TYPES[x.Type]
    return { parent: folderType, name: joinedFolders, key: folderType + '/' + joinedFolders }
  }

  const s1 = _(allFolders.records)
    .filter((x: {Type: string}) => FOLDERED_METAS.includes(x.Type))
    .map((x: {Type: any; DeveloperName: any}) => ({ type: x.Type, folder: x.DeveloperName }))
    .tap((x: {type: string; folder: string}) => logger.appendLine(`Fetching folder ${x.folder}...`))
    .batch(3)
    .map((metas: any) => sfdc.listMetadata(metas))
    .resolve(10, false)
    .flatMap((x: {result: any}) => x || [])
    .map(appendAllFoldersToFilename)
    .map((x: {type: string; fullName: string}) => ({ parent: x.type, name: x.fullName, key: x.type + '/' + x.fullName }))

  const s2 = _(allFolders.records)
    .reject((x: {DeveloperName: string}) => x.DeveloperName === 'unfiled$public')
    .map(appendAllFoldersToFolder)

  const supportedChildren = new Set(supportedChildTypes)
  const metadataTypes = [...new Set(asArray(metadataDescription.metadataObjects)
    .filter((metadata: {inFolder: string}) => metadata.inFolder !== 'true')
    .flatMap((metadata: {xmlName: string; childXmlNames?: string | string[]}) => [
      metadata.xmlName,
      ...asArray(metadata.childXmlNames).filter(type => supportedChildren.has(type))
    ]))]

  const s3 = _(metadataTypes)
    .map((x: string) => ({ type: x }))
    .tap((x: {type: string}) => logger.appendLine(`Fetching metadata ${x.type}...`))
    .batch(3)
    .map((x: any) => sfdc.listMetadata(x))
    .resolve(10, false)
    .flatMap((x: any) => x || [])
    .filter((x:any) => x.manageableState !== 'installed')
    .map((x: {fileName: string; type: string; fullName: string}) => {
      if (x.fileName.startsWith('standardValueSetTranslations')) x.type = 'StandardValueSetTranslation'
      if (x.fileName.startsWith('globalValueSetTranslations')) x.type = 'GlobalValueSetTranslation'
      const key = x.type + '/' + x.fullName
      const fullName = componentAliases.get(key) || x.fullName
      return { parent: x.type, name: fullName, key: x.type + '/' + fullName }
    })

  return await _([s1, s2, s3])
    .merge()
    .uniqBy('key')
    .sortBy((a: {key: string}, b: {key: string}) => a.key > b.key ? 1 : -1)
    .groupBy((x: {parent: any}) => x.parent)
    .flatMap(Object.entries)
    .map(([k, v]: [string, {name: any}[]]) => [k, v.map(x => x.name)])
    .collect()
    .map(Object.fromEntries)
    .value()
}
