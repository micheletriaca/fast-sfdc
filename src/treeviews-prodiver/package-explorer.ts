import * as vscode from 'vscode'
import * as fs from 'fs'
import connector from '../sfdc-connector'
import statusbar from '../statusbar'
import { getPackageMapping, getPackageXml } from 'sfdy/package-utils'
import pkgService from '../services/package-service'
import { setBasePath } from 'sfdy/path-service'
import * as path from 'path'
import utils from '../utils/utils'
import fetch from '../utils/org-fetcher'
import configService from '../services/config-service'
import { resolveSourceLayout } from '../services/source-layout-service'
import { getAdapter, getComponentModel } from 'sfdy/format-adapters'
import { buildMetadataTree, componentKey, getSelectionState, MetadataComponent, MetadataTreeNode } from '../services/metadata-tree-service'
import globby = require('globby')

export class Dependency extends vscode.TreeItem {
  public children: Dependency[];
  public hasWildcard: boolean;

  constructor (public node: MetadataTreeNode) {
    super(
      node.label,
      node.children.length
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    )
    this.id = node.key
    this.hasWildcard = !!node.metadataType && (treeview.pkgMap?.has(`${node.metadataType}/*`) || false)
    this.children = node.children.map(child => new Dependency(child))
    if (node.loading) this.contextValue = 'downloading'
    this.tooltip = this._tooltip
    this.description = this._description
  }

  updateFrom (next: Dependency) {
    this.node = next.node
    this.children = next.children
    this.hasWildcard = next.hasWildcard
    this.label = next.label
    this.collapsibleState = next.collapsibleState
    this.contextValue = next.contextValue
    this.tooltip = next.tooltip
    this.description = next.description
    this.iconPath = this.getIconPath()
  }

  getIconPath (): vscode.ThemeIcon | {light: vscode.Uri; dark: vscode.Uri} {
    if (this.contextValue === 'downloading') {
      return new vscode.ThemeIcon('sync~spin')
    } else if (this.hasWildcard) {
      return new vscode.ThemeIcon('extensions-star-full')
    } else if (this.selectionState === 'none') {
      return new vscode.ThemeIcon(this.node.metadataType ? 'package' : 'variable')
    } else {
      const basePath = (vscode.extensions.getExtension('m1ck83.fast-sfdc') || {}).extensionPath || ''
      const imgPath = path.resolve(basePath, `images/dark/selected-${this.selectionState}.svg`)
      return {
        light: vscode.Uri.file(imgPath),
        dark: vscode.Uri.file(imgPath)
      }
    }
  }

  get inPackage (): boolean {
    return this.selectionState !== 'none'
  }

  get selectionState () {
    return getSelectionState(this.node, treeview.pkgMap)
  }

  get _tooltip (): string {
    return this.operationPath || this.node.label
  }

  get _description (): string {
    return ''
  }

  get operationPath (): string | undefined {
    return this.node.operationComponent && componentKey(this.node.operationComponent)
  }

  get retrievableNodes (): Dependency[] {
    if (this.operationPath) return [this]
    return this.children.flatMap(child => child.retrievableNodes)
  }
}

class PackageExplorerProvider implements vscode.TreeDataProvider<Dependency> {
  private initialized = false
  private finalDependencyTree: Dependency[] = []
  private localComponents: MetadataComponent[] = []
  private orgComponents: MetadataComponent[] = []
  private componentModel: ReturnType<typeof getComponentModel> | null = null
  private visibleMetadataTypes = new Set<string>()
  private treeView: vscode.TreeView<Dependency> | undefined
  private initialRenderResolve: (() => void) | undefined
  private remainingFetchResolve: ((shouldContinue: boolean) => void) | undefined
  private loadGeneration = 0
  private filtering = false
  private filteringInitialized = false
  private hasLocalMetadata = false
  public pkgMap: Set<string> | null = null

  getTreeItem (element: Dependency): vscode.TreeItem {
    element.iconPath = element.getIconPath()
    if (element.node.metadataType && this.initialRenderResolve) {
      this.initialRenderResolve()
      this.initialRenderResolve = undefined
    }
    return element
  }

  calcItems () {
    return this.finalDependencyTree
      .filter(x => !this.filtering || x.inPackage)
  }

  attachTreeView (treeView: vscode.TreeView<Dependency>) {
    this.treeView = treeView
  }

  private updateProgress (pendingTypes: number) {
    if (!this.treeView) return
    this.treeView.description = pendingTypes ? `${pendingTypes} loading…` : undefined
    this.treeView.badge = pendingTypes
      ? { value: pendingTypes, tooltip: `${pendingTypes} metadata types still loading` }
      : undefined
  }

  private updateFilterContext () {
    vscode.commands.executeCommand('setContext', 'fast-sfdc-package-filtering', this.filtering)
    vscode.commands.executeCommand('setContext', 'fast-sfdc-package-has-metadata', this.hasLocalMetadata)
  }

  private waitForInitialRender (): Promise<void> {
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        this.initialRenderResolve = undefined
        resolve()
      }, 1000)
      this.initialRenderResolve = () => {
        clearTimeout(timeout)
        resolve()
      }
    })
  }

  getChildren (element?: Dependency): Dependency[] {
    if (element) {
      return element.children
    } else if (!this.initialized) {
      this.initialized = true
      const generation = ++this.loadGeneration
      this.finalDependencyTree = [new Dependency({
        key: 'loading/package-explorer',
        label: 'Loading Package Explorer…',
        loading: true,
        children: []
      })]
      statusbar.startLongJob(async done => {
        let jobFinished = false
        const finishJob = (status: string) => {
          if (jobFinished) return
          jobFinished = true
          done(status)
        }
        try {
          setBasePath(utils.getWorkspaceFolder())
          const sfdcConnector = await pkgService.getSfdcConnector()
          const sfdyConfig = configService.getSfdyConfigSync()
          const layout = resolveSourceLayout(utils.getWorkspaceFolder(), sfdyConfig)
          const packageMapping = await getPackageMapping(sfdcConnector)
          const componentModel = getComponentModel(packageMapping)
          this.componentModel = componentModel
          const sourceFiles = await globby(['**/*'], { cwd: layout.root })
          let localComponents: MetadataComponent[]
          if (layout.isSourceFormat) {
            const adapter = getAdapter(sfdyConfig, undefined, packageMapping)
            if (!adapter) throw Error('Unable to initialize the source-format adapter')
            localComponents = adapter.resolve(sourceFiles.filter(adapter.isMetadataPath))
          } else {
            const packageComponents = ((await getPackageXml({
              specificFiles: ['**/*'],
              sfdcConnector,
              apiVersion: layout.apiVersion
            })).types || [])
              .flatMap(type => type.members.map(fullName => ({ type: type.name[0], fullName })))
            const semanticEntries = await Promise.all(sourceFiles
              .filter((fileName: string) =>
                componentModel.isMetadataContainerPath(fileName) ||
                  componentModel.isMetadataFolderPath(fileName))
              .map(async fileName => ({
                fileName,
                data: await fs.promises.readFile(path.resolve(layout.root, fileName))
              })))
            const semanticComponents = await componentModel.resolveMetadata(semanticEntries)
            const folderPackageKeys = new Set(semanticComponents
              .filter((component: MetadataComponent) => componentModel.getFolderLocation(component)?.isFolder)
              .flatMap((component: MetadataComponent) => componentModel.getPackageComponents([component]))
              .map((component: MetadataComponent) => componentKey({
                ...component,
                fullName: component.fullName.replace(/\/$/, '')
              })))
            localComponents = [
              ...packageComponents.filter(component => !folderPackageKeys.has(componentKey(component))),
              ...semanticComponents
            ]
          }

          this.pkgMap = new Set(localComponents.map(componentKey))
          this.localComponents = localComponents
          this.hasLocalMetadata = this.pkgMap.size > 0
          if (!this.hasLocalMetadata) {
            this.filtering = false
          } else if (!this.filteringInitialized) {
            this.filtering = true
          }
          this.filteringInitialized = true
          this.updateFilterContext()
          const priorityTypes = [...new Set(localComponents.map(component => component.type))]
          this.rebuild(priorityTypes)

          const orgTreePromise = fetch(
            connector,
            componentModel.getAddressableChildTypes(),
            async (partialTree, pendingTypes) => {
              if (generation !== this.loadGeneration) return
              const isInitialTree = this.visibleMetadataTypes.size === 0
              const renderBarrier = isInitialTree ? this.waitForInitialRender() : undefined
              this.orgComponents = Object.entries(partialTree)
                .flatMap(([type, fullNames]) => fullNames.map(fullName => ({ type, fullName })))
              pendingTypes.forEach(type => this.visibleMetadataTypes.add(type))
              this.rebuild(pendingTypes)
              this.updateProgress(pendingTypes.length)
              if (renderBarrier) await renderBarrier
              else await new Promise(resolve => setTimeout(resolve, 0))
            },
            priorityTypes,
            async () => {
              if (generation !== this.loadGeneration) return false
              if (!this.filtering) return true
              finishJob('👍🏻')
              this.updateProgress(0)
              const shouldContinue = await new Promise<boolean>(resolve => { this.remainingFetchResolve = resolve })
              this.remainingFetchResolve = undefined
              return shouldContinue && generation === this.loadGeneration
            }
          )
          const dependencyTree: {[key: string]: string[]} = await orgTreePromise
          if (generation !== this.loadGeneration) {
            finishJob('')
            return
          }
          this.orgComponents = Object.entries(dependencyTree)
            .flatMap(([type, fullNames]) => fullNames.map(fullName => ({ type, fullName })))
          this.rebuild([])
          this.updateProgress(0)
          finishJob('👍🏻')
        } catch (e) {
          if (generation !== this.loadGeneration) {
            finishJob('')
            return
          }
          finishJob('👎🏻')
          this.updateProgress(0)
          this.finalDependencyTree = [new Dependency({
            key: 'error/package-explorer',
            label: `Unable to load Package Explorer: ${String(e?.message || e)}`,
            children: []
          })]
          this._onDidChangeTreeData.fire(undefined)
        }
      })
      return this.calcItems()
    } else {
      return this.calcItems()
    }
  }

  private rebuild (pendingTypes: string[]) {
    if (!this.componentModel) return
    const roots = buildMetadataTree(
      [...this.localComponents, ...this.orgComponents],
      this.componentModel
    )
    const rootsByType = new Map(roots.map(root => [root.metadataType, root]))
    const pending = new Set(pendingTypes)
    for (const metadataType of pending) {
      const existing = rootsByType.get(metadataType)
      if (existing) {
        existing.loading = pending.has(metadataType)
      } else {
        roots.push({
          key: `type/${metadataType}`,
          label: metadataType,
          metadataType,
          loading: pending.has(metadataType),
          children: []
        })
      }
    }
    roots.sort((left, right) => left.label.localeCompare(right.label))
    const previousRoots = new Map(this.finalDependencyTree.map(root => [root.node.key, root]))
    const changed: Dependency[] = []
    const descendantKeys = (item: Dependency): string[] => [
      item.node.key,
      ...item.children.flatMap(descendantKeys)
    ]
    let structureChanged = roots.length !== this.finalDependencyTree.length
    this.finalDependencyTree = roots.map(node => {
      const next = new Dependency(node)
      const previous = previousRoots.get(node.key)
      if (!previous) {
        structureChanged = true
        return next
      }
      const changedItem = previous.node.loading !== node.loading ||
        descendantKeys(previous).join('\n') !== descendantKeys(next).join('\n')
      previous.updateFrom(next)
      if (changedItem) changed.push(previous)
      previousRoots.delete(node.key)
      return previous
    })
    if (previousRoots.size) structureChanged = true
    if (structureChanged) this._onDidChangeTreeData.fire(undefined)
    else if (changed.length) this._onDidChangeTreeData.fire(changed)
  }

  public _onDidChangeTreeData = new vscode.EventEmitter<Dependency | Dependency[] | undefined>();
  readonly onDidChangeTreeData: vscode.Event<Dependency | Dependency[] | undefined> = this._onDidChangeTreeData.event;

  refresh = () => {
    treeview.loadGeneration++
    treeview.finalDependencyTree = []
    treeview.localComponents = []
    treeview.orgComponents = []
    treeview.componentModel = null
    treeview.visibleMetadataTypes.clear()
    treeview.initialRenderResolve = undefined
    treeview.remainingFetchResolve?.(false)
    treeview.remainingFetchResolve = undefined
    treeview.updateProgress(0)
    this._onDidChangeTreeData.fire(undefined)
    setTimeout(() => {
      this.initialized = false
      this._onDidChangeTreeData.fire(undefined)
    }, 200)
  }

  filter = () => {
    if (!this.hasLocalMetadata) return
    this.filtering = !this.filtering
    if (!this.filtering) this.remainingFetchResolve?.(true)
    this.updateFilterContext()
    this._onDidChangeTreeData.fire(undefined)
  }

  refreshItem = (x: Dependency[]) => {
    x.forEach(x => this._onDidChangeTreeData.fire(x))
  }
}

const treeview = new PackageExplorerProvider()
export default treeview
