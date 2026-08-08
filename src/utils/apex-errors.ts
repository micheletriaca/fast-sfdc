export const extractInvalidApexClassNames = (error: any): string[] => {
  const message = String(error?.message || error || '')
  if (!message.includes('Dependent class is invalid and needs recompilation')) return []

  const classNames: string[] = []
  const classPattern = /\bClass\s+([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)\s*:/g
  let match: RegExpExecArray | null
  while ((match = classPattern.exec(message))) {
    if (!classNames.includes(match[1])) classNames.push(match[1])
  }
  return classNames
}

export const extractApexClassImports = (source: string): string[] => {
  const classNames: string[] = []
  const importPattern = /['"]@salesforce\/apex\/([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = importPattern.exec(source))) {
    const referenceParts = match[1].split('.')
    if (referenceParts.length < 2) continue
    referenceParts.pop()
    const className = referenceParts.join('.')
    if (!classNames.includes(className)) classNames.push(className)
  }
  return classNames
}

export interface MissingRelationship {
  entityName: string;
  relationshipName: string;
}

export interface MissingField {
  entityName: string;
  fieldName: string;
}

export const extractMissingRelationships = (error: any): MissingRelationship[] => {
  const message = String(error?.message || error || '')
  const relationships: MissingRelationship[] = []
  const relationshipPattern = /No such relation '([^']+)' on entity '([^']+)'/g
  let match: RegExpExecArray | null
  while ((match = relationshipPattern.exec(message))) {
    const relationship = { relationshipName: match[1], entityName: match[2] }
    if (!relationships.some(item => item.relationshipName === relationship.relationshipName && item.entityName === relationship.entityName)) {
      relationships.push(relationship)
    }
  }
  return relationships
}

export const extractMissingFields = (error: any): MissingField[] => {
  const message = String(error?.message || error || '')
  const fields: MissingField[] = []
  const fieldPattern = /No such column '([^']+)' on entity '([^']+)'/g
  let match: RegExpExecArray | null
  while ((match = fieldPattern.exec(message))) {
    const field = { fieldName: match[1], entityName: match[2] }
    if (!fields.some(item => item.fieldName === field.fieldName && item.entityName === field.entityName)) {
      fields.push(field)
    }
  }
  return fields
}

export const extractInvalidSObjectFields = (error: any): MissingField[] => {
  const message = String(error?.message || error || '')
  const fields: MissingField[] = []
  const fieldPattern = /Invalid reference ([A-Za-z_][A-Za-z0-9_]*\.([A-Za-z_][A-Za-z0-9_]*)) of type sobjectField/g
  let match: RegExpExecArray | null
  while ((match = fieldPattern.exec(message))) {
    const field = {
      entityName: match[1].slice(0, match[1].lastIndexOf('.')),
      fieldName: match[2]
    }
    if (!fields.some(item => item.fieldName === field.fieldName && item.entityName === field.entityName)) {
      fields.push(field)
    }
  }
  return fields
}

export const extractMissingApexVariables = (error: any): string[] => {
  const message = String(error?.message || error || '')
  const variableNames: string[] = []
  const variablePattern = /\bVariable does not exist:\s*([A-Za-z_][A-Za-z0-9_]*)/g
  let match: RegExpExecArray | null
  while ((match = variablePattern.exec(message))) {
    if (!variableNames.includes(match[1])) variableNames.push(match[1])
  }
  return variableNames
}
