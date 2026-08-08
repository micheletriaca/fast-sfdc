import * as vscode from 'vscode'
import * as fs from 'fs'
import connector from '../sfdc-connector'
import statusbar from '../statusbar'
import { getPackageMapping, getPackageXml } from 'sfdy/package-utils'
import pkgService from '../services/package-service'
import { setBasePath } from 'sfdy/path-service'
import * as path from 'upath'
import utils from '../utils/utils'
import fetch from '../utils/org-fetcher'
import configService from '../services/config-service'
import { resolveSourceLayout } from '../services/source-layout-service'
import { getAdapter, getComponentModel } from 'sfdy/format-adapters'
import { buildMetadataTree, componentKey, MetadataComponent, MetadataTreeNode } from '../services/metadata-tree-service'
import globby = require('globby')

export class Dependency extends vscode.TreeItem {
  public readonly children: Dependency[];
  public readonly hasWildcard: boolean;

  constructor (public readonly node: MetadataTreeNode) {
    super(
      node.label,
      node.children.length
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    )
    this.hasWildcard = !!node.metadataType && (treeview.pkgMap?.has(`${node.metadataType}/*`) || false)
    this.children = node.children.map(child => new Dependency(child))
    this.tooltip = this._tooltip
    this.description = this._description
  }

  getIconPath (): vscode.ThemeIcon | {light: string; dark: string} {
    if (this.contextValue === 'downloading') {
      return new vscode.ThemeIcon('sync~spin')
    } else if (this.hasWildcard) {
      return new vscode.ThemeIcon('extensions-star-full')
    } else if (!this.inPackage) {
      return new vscode.ThemeIcon(this.node.metadataType ? 'package' : 'variable')
    } else {
      const basePath = (vscode.extensions.getExtension('m1ck83.fast-sfdc') || {}).extensionPath || ''
      const imgPath = path.resolve(basePath, `images/dark/selected-${this.inPackage ? 'all' : 'some'}.svg`)
      return {
        light: imgPath,
        dark: imgPath
      }
    }
  }

  get inPackage (): boolean {
    if (this.node.component && treeview.pkgMap?.has(componentKey(this.node.component))) return true
    if (this.node.metadataType && (
      treeview.pkgMap?.has(this.node.metadataType) ||
      treeview.pkgMap?.has(`${this.node.metadataType}/*`)
    )) return true
    return this.children.some(child => child.inPackage)
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
    const directChildren = this.children.filter(child => child.operationPath)
    return directChildren.length
      ? directChildren
      : this.children.flatMap(child => child.retrievableNodes)
  }
}

class PackageExplorerProvider implements vscode.TreeDataProvider<Dependency> {
  private initialized = false
  private finalDependencyTree: Dependency[] = []
  private filtering = true
  public onlyInOrg = true
  public pkgMap: Set<string> | null = null

  getTreeItem (element: Dependency): vscode.TreeItem {
    element.iconPath = element.getIconPath()
    return element
  }

  calcItems () {
    return this.finalDependencyTree
      .filter(x => !this.filtering || x.inPackage)
      .filter(x => this.isVisible(x))
  }

  private isVisible = (item: Dependency): boolean =>
    !this.onlyInOrg || !item.inPackage || item.children.some(this.isVisible)

  async getChildren (element?: Dependency): Promise<Dependency[]> {
    if (element) {
      const children = element.children
      return children.filter(this.isVisible)
    } else if (!this.initialized) {
      return new Promise((resolve, reject) => {
        statusbar.startLongJob(async done => {
          try {
            setBasePath(utils.getWorkspaceFolder())
            const sfdcConnector = await pkgService.getSfdcConnector()
            const sfdyConfig = configService.getSfdyConfigSync()
            const layout = resolveSourceLayout(utils.getWorkspaceFolder(), sfdyConfig)
            const packageMapping = await getPackageMapping(sfdcConnector)
            const componentModel = getComponentModel(packageMapping)
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
              const containerEntries = await Promise.all(sourceFiles
                .filter(componentModel.isMetadataContainerPath)
                .map(async fileName => ({
                  fileName,
                  data: await fs.promises.readFile(path.resolve(layout.root, fileName))
                })))
              localComponents = [
                ...packageComponents,
                ...await componentModel.resolveMetadata(containerEntries)
              ]
            }

            this.pkgMap = new Set(localComponents.flatMap(component => [
              component.type,
              componentKey(component)
            ]))
            const dependencyTree: {[key: string]: string[]} = await fetch(
              connector,
              componentModel.getAddressableChildTypes()
            )
            const orgComponents = Object.entries(dependencyTree)
              .flatMap(([type, fullNames]) => fullNames.map(fullName => ({ type, fullName })))
            this.finalDependencyTree = buildMetadataTree(
              [...localComponents, ...orgComponents],
              componentModel
            ).map(node => new Dependency(node))
            resolve(this.calcItems())
            this.initialized = true
            done('👍🏻')
          } catch (e) {
            done('👎🏻')
            reject(e)
          }
        })
      })
    } else {
      return this.calcItems()
    }
  }

  public _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined> = new vscode.EventEmitter<Dependency | undefined>();
  readonly onDidChangeTreeData: vscode.Event<Dependency | undefined> = this._onDidChangeTreeData.event;

  refresh = () => {
    treeview.finalDependencyTree = []
    this._onDidChangeTreeData.fire(undefined)
    setTimeout(() => {
      this.initialized = false
      this._onDidChangeTreeData.fire(undefined)
    }, 200)
  }

  filter = () => {
    this.filtering = !this.filtering
    this._onDidChangeTreeData.fire(undefined)
  }

  filterOnlyInOrg = () => {
    this.onlyInOrg = !this.onlyInOrg
    this._onDidChangeTreeData.fire(undefined)
  }

  refreshItem = (x: Dependency[]) => {
    x.forEach(x => this._onDidChangeTreeData.fire(x))
  }
}

const treeview = new PackageExplorerProvider()
export default treeview
