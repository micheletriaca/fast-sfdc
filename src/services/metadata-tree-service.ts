export type MetadataComponent = {
  type: string;
  fullName: string;
  scope?: 'root';
}

export type ComponentModel = {
  getComponentLocation: (component: MetadataComponent) => {
    parent: MetadataComponent;
    group: string;
    label: string;
    addressable: boolean;
  } | undefined;
  getContainerRoot: (component: MetadataComponent) => {
    label: string;
    component: MetadataComponent;
  } | undefined;
  getFolderLocation: (component: MetadataComponent) => {
    rootType: string;
    folderType: string;
    folderPath: string;
    label: string;
    isFolder: boolean;
  } | undefined;
  getPackageComponents: (components: MetadataComponent[]) => MetadataComponent[];
}

export type MetadataTreeNode = {
  key: string;
  label: string;
  metadataType?: string;
  component?: MetadataComponent;
  operationComponent?: MetadataComponent;
  children: MetadataTreeNode[];
}

export type SelectionState = 'none' | 'some' | 'all'

export const componentKey = (component: MetadataComponent) =>
  `${component.type}/${component.fullName}`

export const getSelectionState = (
  node: MetadataTreeNode,
  selected: Set<string> | null
): SelectionState => {
  if (!selected) return 'none'
  if (node.metadataType && selected.has(`${node.metadataType}/*`)) return 'all'
  if (node.component && selected.has(componentKey(node.component))) return 'all'
  if (!node.children.length) return 'none'
  const childStates = node.children.map(child => getSelectionState(child, selected))
  if (childStates.every(state => state === 'all')) return 'all'
  return childStates.some(state => state !== 'none') ? 'some' : 'none'
}

const sortNodes = (nodes: MetadataTreeNode[]): MetadataTreeNode[] => nodes
  .sort((left, right) => left.label.localeCompare(right.label))
  .map(node => ({ ...node, children: sortNodes(node.children) }))

export const buildMetadataTree = (
  components: MetadataComponent[],
  model: ComponentModel
): MetadataTreeNode[] => {
  const roots = new Map<string, MetadataTreeNode>()
  const nodes = new Map<string, MetadataTreeNode>()

  const getRoot = (metadataType: string) => {
    let root = roots.get(metadataType)
    if (!root) {
      root = {
        key: `type/${metadataType}`,
        label: metadataType,
        metadataType,
        children: []
      }
      roots.set(metadataType, root)
    }
    return root
  }

  const getComponentNode = (component: MetadataComponent) => {
    const key = componentKey(component)
    let node = nodes.get(key)
    if (!node) {
      node = {
        key,
        label: component.fullName,
        component,
        operationComponent: component,
        children: []
      }
      nodes.set(key, node)
      getRoot(component.type).children.push(node)
      const containerRoot = model.getContainerRoot(component)
      if (containerRoot) {
        const rootNode = {
          key: `${key}#root`,
          label: containerRoot.label,
          component,
          operationComponent: containerRoot.component,
          children: []
        }
        nodes.set(rootNode.key, rootNode)
        node.children.push(rootNode)
      }
    }
    return node
  }

  const ensureFolderNode = (
    rootType: string,
    folderType: string,
    folderPath: string,
    includeMetadata = false
  ): MetadataTreeNode => {
    let parent = getRoot(rootType)
    let currentPath = ''
    for (const segment of folderPath.split('/').filter(Boolean)) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      const component = { type: folderType, fullName: currentPath }
      const key = `folder/${componentKey(component)}`
      let node = nodes.get(key)
      if (!node) {
        node = {
          key,
          label: segment,
          children: []
        }
        nodes.set(key, node)
        parent.children.push(node)
      }
      if (includeMetadata && currentPath === folderPath) {
        const metadataKey = componentKey(component)
        if (!nodes.has(metadataKey)) {
          const metadataNode = {
            key: metadataKey,
            label: 'folder metadata',
            component,
            operationComponent: model.getPackageComponents([component])[0],
            children: []
          }
          nodes.set(metadataKey, metadataNode)
          node.children.push(metadataNode)
        }
      }
      parent = node
    }
    return parent
  }

  const uniqueComponents = [...new Map(components.map(component => [componentKey(component), component])).values()]
  for (const component of uniqueComponents) {
    const folder = model.getFolderLocation(component)
    if (folder?.isFolder) {
      ensureFolderNode(folder.rootType, folder.folderType, folder.folderPath, true)
    }
  }
  for (const component of uniqueComponents) {
    const folder = model.getFolderLocation(component)
    if (folder) {
      if (folder.isFolder) continue
      const parent = folder.folderPath
        ? ensureFolderNode(folder.rootType, folder.folderType, folder.folderPath)
        : getRoot(folder.rootType)
      const key = componentKey(component)
      if (!nodes.has(key)) {
        const node = {
          key,
          label: folder.label,
          component,
          operationComponent: component,
          children: []
        }
        nodes.set(key, node)
        parent.children.push(node)
      }
      continue
    }
    const location = model.getComponentLocation(component)
    if (!location) {
      getComponentNode(component)
      continue
    }

    const parent = getComponentNode(location.parent)
    const groupKey = `group/${componentKey(location.parent)}/${location.group}`
    let group = nodes.get(groupKey)
    if (!group) {
      group = {
        key: groupKey,
        label: location.group,
        children: []
      }
      nodes.set(groupKey, group)
      parent.children.push(group)
    }

    let child = nodes.get(componentKey(component))
    if (!child) {
      child = {
        key: componentKey(component),
        label: location.label,
        component,
        operationComponent: model.getPackageComponents([component])[0],
        children: []
      }
      nodes.set(child.key, child)
    } else {
      child.label = location.label
      child.operationComponent = model.getPackageComponents([component])[0]
    }
    if (!group.children.some(node => node.key === child?.key)) group.children.push(child)
  }

  return sortNodes([...roots.values()])
}
