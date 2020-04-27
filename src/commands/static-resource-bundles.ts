import * as vscode from 'vscode'
import configService from '../services/config-service'
import * as path from 'path'
import * as multimatch from 'multimatch'
import * as _ from 'highland'
import { readdirSync, readFileSync } from 'fs'
import utils from '../utils/utils'
import retrieve from './retrieve'

export default async function configureBundles () {
  const sfdyConfig = configService.getSfdyConfigSync()
  const srPath = path.resolve(vscode.workspace.rootPath || '', 'src', 'staticresources')
  const files = await _(readdirSync(srPath))
    .filter(x => x.endsWith('.resource-meta.xml'))
    .map(async x => ({
      fileName: x,
      contentType: (await utils.parseXml(readFileSync(path.join(srPath, x)))).StaticResource.contentType[0]
    }))
    .map(x => _(x))
    .sequence()
    .filter(x => x.contentType === 'application/zip')
    .map(x => x.fileName.replace('-meta.xml', ''))
    .collect()
    .toPromise(Promise)

  const savedSr = new Set(multimatch(files, sfdyConfig?.staticResources?.useBundleRenderer || []))
  const selectedSr = await vscode.window.showQuickPick(files.sort().map(x => ({
    label: x,
    picked: savedSr.has(x)
  })), {
    ignoreFocusOut: true,
    canPickMany: true,
    placeHolder: 'Select zip static resources that you want to handle as bundles',
    matchOnDetail: true
  })

  if (!selectedSr) return
  const allFilesToRefresh = [...savedSr, ...(selectedSr || []).map(x => x.label)].map(x => 'staticresources/' + x)
  sfdyConfig.staticResources = sfdyConfig.staticResources || {}
  sfdyConfig.staticResources.useBundleRenderer = (selectedSr || []).map(x => x.label)
  await configService.storeSfdyConfig(sfdyConfig)
  if (allFilesToRefresh.length > 0) {
    retrieve(allFilesToRefresh)
  }
}
