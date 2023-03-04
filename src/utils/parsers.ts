import * as vscode from 'vscode'
import * as path from 'upath'
import { AuraDefType } from '../fast-sfdc'

export default {
  getToolingType (document: vscode.TextDocument): string {
    const p = path.toUnix(document.fileName)
    const isAuraBundle = p.indexOf('/aura/') !== -1
    const isLwcBundle = p.indexOf('/lwc/') !== -1

    if (isAuraBundle) return 'AuraDefinition'
    if (isLwcBundle) return 'LightningComponentResource'

    const extension = p.substring(p.lastIndexOf('.'))
    switch (extension) {
      case '.cls': return 'ApexClassMember'
      case '.trigger': return 'ApexTriggerMember'
      case '.component': return 'ApexComponentMember'
      case '.page': return 'ApexPageMember'
      case '.resource': return 'StaticResource'
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
    const fp = path.toUnix(path.normalize(fullPath))
    return fp.substring(fp.lastIndexOf('/') + 1, fp.lastIndexOf('.'))
  },

  getMethodName (methodSign: string) {
    const voidType = ' void '
    return methodSign.substring(methodSign.lastIndexOf(voidType) + voidType.length, methodSign.lastIndexOf('(')).trim()
  },

  getAuraBundleName (docUri: vscode.Uri) {
    const p = path.toUnix(docUri.fsPath)
    return p.substring(p.indexOf('aura/') + 5, p.lastIndexOf('/'))
  },

  getLwcBundleName (docUri: vscode.Uri) {
    const p = path.toUnix(docUri.fsPath)
    const firstIndex = p.indexOf('lwc/') + 4
    return p.substring(firstIndex, p.indexOf('/', firstIndex))
  },

  getLastFolder (docUri: vscode.Uri) {
    const p = path.toUnix(docUri.fsPath)
    return p.substring(0, p.lastIndexOf('/'))
  }
}
