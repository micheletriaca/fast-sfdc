import * as _ from 'exstream.js'
import { reporter } from '../logger'

export default async function fetch (sfdc: SfdcConnector) {
  reporter.sendEvent('sfdcExplorer')
  const FOLDERED_METAS = ['Report', 'Dashboard', 'EmailTemplate', 'Document']

  const allFolders = await sfdc.query('SELECT Id, ParentId, NamespacePrefix, DeveloperName, Type FROM Folder WHERE DeveloperName != null', true)
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
    return { parent: x.Type, name: joinedFolders, key: x.Type + '/' + joinedFolders }
  }

  const s1 = _(allFolders.records)
    .filter((x: {Type: string}) => FOLDERED_METAS.includes(x.Type))
    .map((x: {Type: any; DeveloperName: any}) => ({ type: x.Type, folder: x.DeveloperName }))
    .batch(3)
    .map((metas: any) => sfdc.listMetadata(metas))
    .resolve(10, false)
    .flatMap((x: {result: any}) => x || [])
    .map(appendAllFoldersToFilename)
    .map((x: {type: string; fullName: string}) => ({ parent: x.type, name: x.fullName, key: x.type + '/' + x.fullName }))

  const s2 = _(allFolders.records)
    .reject((x: {DeveloperName: string}) => x.DeveloperName === 'unfiled$public')
    .map(appendAllFoldersToFolder)

  const s3 = _(sfdc.describeMetadata())
    .flatMap((x: {metadataObjects: any}) => x.metadataObjects)
    .reject((x: {inFolder: string}) => x.inFolder === 'true')
    .pluck('xmlName')
    .map((x: string) => ({ type: x }))
    .batch(3)
    .map((x: any) => sfdc.listMetadata(x))
    .resolve(10, false)
    .flatMap((x: any) => x || [])
    .filter((x:any) => x.manageableState !== 'installed')
    .map((x: {fileName: string; type: string; fullName: string}) => {
      if (x.fileName.startsWith('standardValueSetTranslations')) x.type = 'StandardValueSetTranslation'
      if (x.fileName.startsWith('globalValueSetTranslations')) x.type = 'GlobalValueSetTranslation'
      return { parent: x.type, name: x.fullName, key: x.type + '/' + x.fullName }
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
