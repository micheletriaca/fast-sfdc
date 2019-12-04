import * as vscode from 'vscode'
import * as path from 'path'
import { AuraDefType } from '../fast-sfdc'

export default {
  getToolingType (document: vscode.TextDocument): string {
    const isAuraBundle = document.uri.fsPath.indexOf(`${path.sep}aura${path.sep}`) !== -1
    const isLwcBundle = document.uri.fsPath.indexOf(`${path.sep}lwc${path.sep}`) !== -1

    if (isAuraBundle) return 'AuraDefinition'
    if (isLwcBundle) return 'LightningComponentResource'

    const extension = document.fileName.substring(document.fileName.lastIndexOf('.'))
    switch (extension) {
      case '.cls': return 'ApexClassMember'
      case '.trigger': return 'ApexTriggerMember'
      case '.component': return 'ApexComponentMember'
      case '.page': return 'ApexPageMember'
      case '.permissionset': return 'PermissionSet'
      case '.object': return 'CustomObject'
      case '.labels': return 'CustomLabels'
      default: return ''
    }
  },

  getLWCDefType (fullPath: string) {
    return fullPath.substring(fullPath.lastIndexOf('.') + 1).toLowerCase()
  },

  getAuraDefType (fullPath: string): AuraDefType | '' {
    const extension = fullPath.substring(fullPath.lastIndexOf('.')).toLowerCase()
    const filename = exports.default.getFilename(fullPath).toLowerCase()
    switch (extension) {
      case '.app': return 'APPLICATION'
      case '.cmp': return 'COMPONENT'
      case '.auradoc': return 'DOCUMENTATION'
      case '.css': return 'STYLE'
      case '.evt': return 'EVENT'
      case '.design': return 'DESIGN'
      case '.svg': return 'SVG'
      case '.js':
        if (filename.endsWith('controller')) {
          return 'CONTROLLER'
        } else if (filename.endsWith('helper')) {
          return 'HELPER'
        } else if (filename.endsWith('renderer')) {
          return 'RENDERER'
        }
        break
    }
    return ''
  },

  getAuraFileName (bundleName: string, auraType: AuraDefType) {
    switch (auraType) {
      case 'COMPONENT': return bundleName + '.cmp'
      case 'CONTROLLER': return bundleName + 'Controller.js'
      case 'DESIGN': return bundleName + '.design'
      case 'DOCUMENTATION': return bundleName + '.auradoc'
      case 'HELPER': return bundleName + 'Helper.js'
      case 'RENDERER': return bundleName + 'Renderer.js'
      case 'STYLE': return bundleName + '.css'
      case 'SVG': return bundleName + '.svg'
    }
    throw Error('invalid aura type')
  },

  getFilename (fullPath: string) {
    return fullPath.substring(fullPath.lastIndexOf(path.sep) + 1, fullPath.lastIndexOf('.'))
  },

  getAuraBundleName (docUri: vscode.Uri) {
    return docUri.fsPath.substring(docUri.fsPath.indexOf(`aura${path.sep}`) + 5, docUri.fsPath.lastIndexOf(path.sep))
  },

  getLwcBundleName (docUri: vscode.Uri) {
    const firstIndex = docUri.fsPath.indexOf(`lwc${path.sep}`) + 4
    return docUri.fsPath.substring(firstIndex, docUri.fsPath.indexOf(path.sep, firstIndex))
  },

  getLastFolder (docUri: vscode.Uri) {
    return docUri.fsPath.substring(0, docUri.fsPath.lastIndexOf(path.sep))
  }
}
