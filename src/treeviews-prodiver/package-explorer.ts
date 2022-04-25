import * as vscode from 'vscode'
import connector from '../sfdc-connector'
import statusbar from '../statusbar'
import { getPackageXml } from 'sfdy/src/utils/package-utils'
import pkgService from '../services/package-service'
import { setBasePath } from 'sfdy/src/services/path-service'
import * as path from 'upath'
import utils from '../utils/utils'
import fetch from '../utils/org-fetcher'

export class Dependency extends vscode.TreeItem {
  public parent: Dependency | null = null;

  constructor (
    public readonly label: string,
    public rootElement: boolean,
    public hasWildcard: boolean,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    public children: Dependency[]
  ) {
    super(label, collapsibleState)
    this.tooltip = this._tooltip
    this.description = this._description
    if (children.length) {
      this.children.forEach(x => (x.parent = this))
    }
  }

  get iconPath () {
    if (this.contextValue === 'downloading') {
      return new vscode.ThemeIcon('sync~spin')
    } else if (this.hasWildcard) {
      return new vscode.ThemeIcon('extensions-star-full')
    } else if (!this.inPackage) {
      return new vscode.ThemeIcon(this.rootElement ? 'package' : 'variable')
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
    return treeview.pkgMap?.has(this.fullPath) || false
  }

  get _tooltip (): string {
    return this.label
  }

  get _description (): string {
    return ''
  }

  get parentLabel (): string {
    let cursor = this as Dependency
    let res = this.label
    while (cursor.parent !== null) {
      cursor = cursor.parent
      res = cursor.label
    }
    return res
  }

  get fullPath (): string {
    let cursor = this as Dependency
    const res = [this.label]
    while (cursor.parent !== null) {
      cursor = cursor.parent
      res.unshift(cursor.label)
    }
    return res.join('/')
  }
}

class PackageExplorerProvider implements vscode.TreeDataProvider<Dependency> {
  private initialized = false
  private finalDependencyTree: Dependency[] = []
  private dependencyTree: {[key: string]: string[]} = {}
  private filtering = true
  public onlyInOrg = true
  public pkgMap: Set<string> | null = null

  getTreeItem (element: Dependency): vscode.TreeItem {
    return element
  }

  calcItems () {
    if (!this.initialized) {
      this.finalDependencyTree = Object.entries(this.dependencyTree)
        .map(([x, children]) => new Dependency(
          x,
          true,
          this.pkgMap?.has(x + '/*') || false, //! NO_WILDCARD_METADATA_TIPES.has(x),
          vscode.TreeItemCollapsibleState.Collapsed,
          children.map(y => new Dependency(
            y,
            false,
            false,
            vscode.TreeItemCollapsibleState.None,
            []
          ))
        ))
    }

    return this.finalDependencyTree
      .filter(x => !this.filtering || x.inPackage)
      .filter(x => !this.onlyInOrg || !x.inPackage || (x.children.length && x.children.some(c => !c.inPackage)))
  }

  async getChildren (element?: Dependency): Promise<Dependency[]> {
    if (element) {
      const children = element.children
      return children?.filter(x => !this.onlyInOrg || !x.inPackage)
    } else if (!this.initialized) {
      return new Promise((resolve, reject) => {
        statusbar.startLongJob(async done => {
          try {
            setBasePath(utils.getWorkspaceFolder())
            const sfdcConnector = await pkgService.getSfdcConnector()
            this.pkgMap = new Set(((await getPackageXml({ specificFiles: ['**/*'], sfdcConnector })).types || [])
              .flatMap(t => t.members.map(x => t.name[0] + '/' + x).concat([t.name[0]])))

            this.dependencyTree = await fetch(connector)
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
