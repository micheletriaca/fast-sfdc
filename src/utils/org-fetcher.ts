import logger, { reporter } from '../logger'
import { getMetadataComponentAliases } from '../services/metadata-component-aliases'
import _ = require('exstream.js')

const asArray = <T>(value: T | T[] | undefined): T[] =>
  Array.isArray(value) ? value : value ? [value] : []

export type OrgMetadataProgress = (
  components: {[key: string]: string[]},
  pendingTypes: string[]
) => void | Promise<void>

export default async function fetch (
  sfdc: SfdcConnector,
  supportedChildTypes: string[] = [],
  onProgress?: OrgMetadataProgress,
  priorityTypes: string[] = [],
  waitForRemaining?: () => Promise<boolean>
) {
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
  const allFoldersRequest = sfdc.query(
    'SELECT Id, ParentId, NamespacePrefix, DeveloperName, Type FROM Folder WHERE DeveloperName != null',
    true
  )
  const metadataDescription = await sfdc.describeMetadata()
  const supportedChildren = new Set(supportedChildTypes)
  const metadataTypes = [...new Set(asArray(metadataDescription.metadataObjects)
    .filter((metadata: {inFolder: string}) => metadata.inFolder !== 'true')
    .flatMap((metadata: {xmlName: string; childXmlNames?: string | string[]}) => [
      metadata.xmlName,
      ...asArray(metadata.childXmlNames).filter(type => supportedChildren.has(type))
    ]))]
  const priority = new Set(priorityTypes)
  metadataTypes.sort((left, right) =>
    Number(priority.has(right)) - Number(priority.has(left)) || left.localeCompare(right))

  // As soon as describeMetadata returns, render the complete top level. Folder
  // discovery and component listing can continue without holding back the tree.
  await onProgress?.({}, [...new Set([...metadataTypes, ...FOLDERED_METAS])].sort())

  const [allFolders, personRecordTypes] = await Promise.all([
    allFoldersRequest,
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

  const folderQueries = _(allFolders.records)
    .filter((x: {Type: string}) => FOLDERED_METAS.includes(x.Type))
    .map((x: {Type: any; DeveloperName: any}) => ({ type: x.Type, folder: x.DeveloperName }))
    .values() as {type: string; folder: string}[]
  folderQueries.sort((left, right) =>
    Number(priority.has(right.type)) - Number(priority.has(left.type)) || left.type.localeCompare(right.type))

  const folderEntries = _(allFolders.records)
    .reject((x: {DeveloperName: string}) => x.DeveloperName === 'unfiled$public')
    .map(appendAllFoldersToFolder)
    .values() as {parent: string; name: string; key: string}[]

  const metadataQueries = metadataTypes.map(type => ({ type }))
  const remainingByType = new Map<string, number>()
  for (const query of [...folderQueries, ...metadataQueries]) {
    remainingByType.set(query.type, (remainingByType.get(query.type) || 0) + 1)
  }

  const entries = new Map<string, {parent: string; name: string; key: string}>()
  folderEntries.forEach(entry => entries.set(entry.key, entry))

  const snapshot = () => Object.fromEntries(
    [...entries.values()]
      .sort((left, right) => left.key.localeCompare(right.key))
      .reduce((groups, entry) => {
        const names = groups.get(entry.parent) || []
        names.push(entry.name)
        groups.set(entry.parent, names)
        return groups
      }, new Map<string, string[]>())
  )
  let lastProgressAt = 0
  let progressInFlight: Promise<void> | undefined
  let progressDirty = false
  let progressFailure: any
  const emitProgress = (): Promise<void> => {
    progressDirty = true
    if (progressInFlight) return progressInFlight
    progressInFlight = (async () => {
      while (progressDirty) {
        progressDirty = false
        const delay = Math.max(0, 1000 - (Date.now() - lastProgressAt))
        if (delay) await new Promise(resolve => setTimeout(resolve, delay))
        // Build the snapshot after the delay so every response received during
        // this second is folded into one TreeView update.
        const pendingTypes = [...remainingByType.entries()]
          .filter(([, remaining]) => remaining > 0)
          .map(([type]) => type)
          .sort()
        await onProgress?.(snapshot(), pendingTypes)
        lastProgressAt = Date.now()
      }
    })().finally(() => {
      progressInFlight = undefined
    })
    return progressInFlight
  }
  await emitProgress()

  const chunk = <T>(items: T[], size: number): T[][] => {
    const chunks: T[][] = []
    for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
    return chunks
  }

  const fetchBatches = async <T extends {type: string; folder?: string}> (
    queries: T[],
    transform: (result: any) => {parent: string; name: string; key: string} | undefined
  ) => {
    const batches = chunk(queries, 3)
    let nextBatch = 0
    const worker = async () => {
      while (nextBatch < batches.length) {
        const batch = batches[nextBatch++]
        batch.forEach(query => logger.appendLine(
          query.folder ? `Fetching folder ${query.folder}...` : `Fetching metadata ${query.type}...`
        ))
        const results = asArray(await sfdc.listMetadata(batch))
        results.map(transform).filter(Boolean).forEach(entry => {
          const value = entry as {parent: string; name: string; key: string}
          entries.set(value.key, value)
        })
        batch.forEach(query => remainingByType.set(query.type, (remainingByType.get(query.type) || 1) - 1))
        // Rendering is intentionally decoupled from network throughput.
        emitProgress().catch(error => { progressFailure = error })
      }
    }
    // Network concurrency is independent from the UI refresh cadence: results
    // are folded into the single aggregated TreeView update emitted each second.
    await Promise.all(Array.from({ length: Math.min(10, batches.length) }, worker))
  }

  const transformMetadata = (x: {fileName: string; type: string; fullName: string; manageableState?: string}) => {
    if (x.manageableState === 'installed') return undefined
    if (x.fileName.startsWith('standardValueSetTranslations')) x.type = 'StandardValueSetTranslation'
    if (x.fileName.startsWith('globalValueSetTranslations')) x.type = 'GlobalValueSetTranslation'
    const key = x.type + '/' + x.fullName
    const fullName = componentAliases.get(key) || x.fullName
    return { parent: x.type, name: fullName, key: x.type + '/' + fullName }
  }

  const transformFolder = (result: any) => {
    const item = appendAllFoldersToFilename(result)
    return { parent: item.type, name: item.fullName, key: item.type + '/' + item.fullName }
  }

  const priorityMetadataQueries = metadataQueries.filter(query => priority.has(query.type))
  const remainingMetadataQueries = metadataQueries.filter(query => !priority.has(query.type))
  const priorityFolderQueries = folderQueries.filter(query => priority.has(query.type))
  const remainingFolderQueries = folderQueries.filter(query => !priority.has(query.type))

  await fetchBatches(priorityMetadataQueries, transformMetadata)
  await fetchBatches(priorityFolderQueries, transformFolder)
  await emitProgress()

  if ((remainingMetadataQueries.length || remainingFolderQueries.length) && waitForRemaining) {
    const shouldContinue = await waitForRemaining()
    if (!shouldContinue) return snapshot()
    await emitProgress()
  }

  await fetchBatches(remainingMetadataQueries, transformMetadata)
  await fetchBatches(remainingFolderQueries, transformFolder)
  await emitProgress()
  if (progressFailure) throw progressFailure

  return snapshot()
}
