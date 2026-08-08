import retrieve from './retrieve'
import treeview, { Dependency } from '../treeviews-prodiver/package-explorer'

export default async function retrieveSelected (item: Dependency | null, items: Dependency[]) {
  if (item && !items) items = [item]
  if (items && items.length) {
    const metaToRetrieve = [...new Map(items
      .flatMap(selected => selected.retrievableNodes)
      .filter(selected => selected.operationPath)
      .map(selected => [selected.operationPath, selected])).values()]
    if (!metaToRetrieve.length) return
    metaToRetrieve.forEach(x => { x.contextValue = 'downloading' })
    treeview.refreshItem(metaToRetrieve)
    try {
      await retrieve(metaToRetrieve.map(x => x.operationPath as string), true)
      const markRetrieved = (dependency: Dependency) => {
        if (dependency.node.component) {
          treeview.pkgMap?.add(`${dependency.node.component.type}/${dependency.node.component.fullName}`)
          treeview.pkgMap?.add(dependency.node.component.type)
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
      metaToRetrieve.forEach(x => { x.contextValue = '' })
      treeview.refreshItem(metaToRetrieve)
      treeview._onDidChangeTreeData.fire(undefined)
    }
  }
}
