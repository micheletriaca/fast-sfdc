import * as vscode from 'vscode'

export default {
  getToolingType (document: vscode.TextDocument, isMember = false): string | undefined {
    const isAuraBundle = document.uri.path.indexOf('/aura/') !== -1
    if (isAuraBundle) return 'AuraDefinition'

    const extension = document.fileName.substring(document.fileName.lastIndexOf('.'))
    switch (extension) {
      case '.cls': return `ApexClass${isMember ? 'Member' : ''}`
      case '.trigger': return `ApexTrigger${isMember ? 'Member' : ''}`
      case '.component': return `ApexComponent${isMember ? 'Member' : ''}`
      case '.page': return `ApexPage${isMember ? 'Member' : ''}`
      case '.permissionset': return 'PermissionSet'
      case '.object': return 'CustomObject'
      case '.labels': return 'CustomLabels'
      default: return undefined
    }
  },

  getAuraDefType (document: vscode.TextDocument) {
    const extension = document.fileName.substring(document.fileName.lastIndexOf('.')).toLowerCase()
    const filename = exports.default.getFilename(document).toLowerCase()
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
      default:
        throw new Error(`Unknown extension: ${extension}`)
    }
  },

  getFilename (doc: vscode.TextDocument) {
    return doc.fileName.substring(doc.fileName.lastIndexOf('/') + 1, doc.fileName.lastIndexOf('.'))
  },

  getAuraBundleName (doc: vscode.TextDocument) {
    return doc.fileName.substring(doc.fileName.indexOf('aura/') + 5, doc.fileName.lastIndexOf('/'))
  }
}
