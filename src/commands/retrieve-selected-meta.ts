import retrieve from './retrieve'
import treeview, { Dependency } from '../treeviews-prodiver/package-explorer'
import packageService from '../services/package-service'

export default async function retrieveSelected (item: Dependency | null, items: Dependency[]) {
  if (item && !items) items = [item]
  if (items && items.length) {
    const metaToRetrieve = items.map(x => x.rootElement ? x.children : x).flat()
    metaToRetrieve.forEach(x => { x.contextValue = 'downloading' })
    treeview.refreshItem(metaToRetrieve)
    try {
      await retrieve(metaToRetrieve.map(x => x.fullPath), true)
      metaToRetrieve.forEach(x => treeview.pkgMap?.add(x.fullPath))
      const pkgs = items.map(x => x.rootElement ? x.label : x.parentLabel)
      pkgs.forEach(x => treeview.pkgMap?.add(x))
      packageService.addMetaToPackage(metaToRetrieve.map(x => x.fullPath))
    } finally {
      metaToRetrieve.forEach(x => { x.contextValue = '' })
      treeview.refreshItem(metaToRetrieve)
      treeview._onDidChangeTreeData.fire(undefined)
    }
  }
}
