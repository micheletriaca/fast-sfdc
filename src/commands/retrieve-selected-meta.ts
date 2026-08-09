import retrieve from './retrieve'
import treeview, { Dependency } from '../treeviews-prodiver/package-explorer'
import { MetadataComponent } from '../services/metadata-tree-service'

export default async function retrieveSelected (item: Dependency | null, items: Dependency[]) {
  if (item && (!items || !items.length)) items = [item]
  if (items && items.length) {
    if (items.some(item => item.contextValue === 'downloading')) return
    const selectedNodes = items
      .flatMap(selected => selected.retrievableNodes)
      .filter(selected => selected.operationPath)
    const selectionByPath = new Map<string, Dependency>()
    selectedNodes.forEach(selected => {
      const operationPath = selected.operationPath as string
      const existing = selectionByPath.get(operationPath)
      if (!existing || existing.node.operationComponent?.scope === 'root') {
        selectionByPath.set(operationPath, selected)
      }
    })
    const metaToRetrieve = [...selectionByPath.values()]
    if (!metaToRetrieve.length) return
    const subtreeItems = (dependency: Dependency): Dependency[] => [
      dependency,
      ...dependency.children.flatMap(subtreeItems)
    ]
    const loadingItems = [...new Set([
      ...items.flatMap(subtreeItems),
      ...metaToRetrieve
    ])]
    loadingItems.forEach(x => { x.contextValue = 'downloading' })
    treeview.refreshItem(loadingItems)
    try {
      await retrieve(
        metaToRetrieve.map(x => x.operationPath as string),
        true,
        metaToRetrieve.map(x => x.node.operationComponent as MetadataComponent)
      )
      const markRetrieved = (dependency: Dependency) => {
        if (dependency.node.component) {
          treeview.pkgMap?.add(`${dependency.node.component.type}/${dependency.node.component.fullName}`)
        }
        if (dependency.node.operationComponent) {
          treeview.pkgMap?.add(
            `${dependency.node.operationComponent.type}/${dependency.node.operationComponent.fullName}`
          )
        }
        dependency.children.forEach(markRetrieved)
      }
      metaToRetrieve.forEach(markRetrieved)
    } finally {
      loadingItems.forEach(x => { x.contextValue = '' })
      treeview.refreshItem(loadingItems)
      treeview._onDidChangeTreeData.fire(undefined)
    }
  }
}
