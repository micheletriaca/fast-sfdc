import * as vscode from 'vscode'

export default function getToolingTypeFromBody (document: vscode.TextDocument, isMember = false): string | undefined {
  const extension = document.fileName.substring(document.fileName.lastIndexOf('.') + 1)
  switch (extension) {
    case '.cls': return `ApexClass${isMember && 'Member'}`
    case '.trigger': return `ApexTrigger${isMember && 'Member'}`
    case '.component': return `ApexComponent${isMember && 'Member'}`
    case '.page': return `ApexPage${isMember && 'Member'}`
    case '.permissionset': return 'PermissionSet'
    case '.object': return 'CustomObject'
    case '.labels': return 'CustomLabels'
    default: return undefined
  }
}
