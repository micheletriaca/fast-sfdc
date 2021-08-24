import * as vscode from 'vscode'

type ValidationFn = (value: string) => string | Thenable<string | null | undefined> | null | undefined
interface MyQuickPick extends vscode.QuickPickItem { value?: any }
const booleanOptions = [{ label: 'False', value: false }, { label: 'True', value: true }]

export function prompt (placeHolder: string, validateInput?: ValidationFn, options?: MyQuickPick[], vscodeOpts = {}, allowEmpty = false) {
  return async () => {
    const _opts = { ignoreFocusOut: true, placeHolder, validateInput, ...vscodeOpts }
    const res = options ? await vscode.window.showQuickPick(options, _opts) : await vscode.window.showInputBox(_opts)
    if (!res && !allowEmpty) throw Error('Field Creation Aborted')
    if (typeof (res) === 'string' || res === undefined) return res
    else if (res.value !== undefined && res.value !== null) return res.value
    else return res.label
  }
}

export function promptMany (placeHolder: string, options: vscode.QuickPickItem[], vscodeOpts = {}, allowEmpty = true) {
  return async () => {
    const _opts = { ignoreFocusOut: true, placeHolder, ...vscodeOpts, canPickMany: true }
    const res = await vscode.window.showQuickPick(options, _opts) as vscode.QuickPickItem[] | undefined
    if (!res && !allowEmpty) throw Error('Field Creation Aborted')
    return (res || []).map(x => x.label)
  }
}

const promptLabel = prompt('Insert Field Label', v => v.length > 40 ? 'Field Labels cannot exceed 40 characters' : undefined)
const promptRelationshipLabel = prompt('Insert Relationship Name', v => v.length > 40 ? 'Field Labels cannot exceed 40 characters' : undefined)
const promptRequired = prompt('Is the field Required?', undefined, booleanOptions)
const promptDefaultValue = (options?: vscode.QuickPickItem[]) => prompt('What\'s the default value of the field?', undefined, options, {}, true)()
const promptTrackHistory = prompt('Track history?', undefined, booleanOptions)
const promptIsExternalId = (canBeCaseSensitive = true) => prompt('Is the field an External ID?', undefined, canBeCaseSensitive ? [
  { label: 'False', value: { externalId: false } },
  { label: 'True - case sensitive', value: { externalId: true, caseSensitive: true } },
  { label: 'True - case insensitive', value: { externalId: true, caseSensitive: false } }
] : booleanOptions)()
const promptIsUnique = prompt('Is the field Unique?', undefined, booleanOptions)
const promptLength = (placeholder: string, minLength: number, maxLength: number, defaultValue: number) => {
  const regex = new RegExp(`^[0-9]{${minLength.toString().length},${maxLength.toString().length}}$`)
  return prompt(
    placeholder,
    v => (!regex.test(v) || parseInt(v) < minLength || parseInt(v) > maxLength) ? `Only a number between ${minLength} and ${maxLength} is allowed.` : undefined,
    undefined,
    { value: defaultValue.toString(), valueSelection: [0, defaultValue.toString().length], prompt: `Insert a number between ${minLength} and ${maxLength}` }
  )()
}

const promptApiName = (label: string, forbiddenApiNames: string[]) => {
  const escaped = label.normalize('NFD').replace(/[\u0300-\u036f]|\s*/g, '') + '__c'
  return prompt('Insert Field ApiName', v => {
    if (!(/^[[a-zA-Z0-9_]{3,40}(?<!_)__c$/.test(v))) { return 'Invalid Api Name. Must only use Uppercase or Lowercase Letters, numbers, underscores (\'_\') and terminate with \'__c\'. Length must be between 3 and 40 chars' }
    if (forbiddenApiNames.indexOf(v) !== -1) { return 'Another Field with the same Api Name already exists on the object.' }
    return undefined
  }, undefined, {
    value: escaped,
    valueSelection: [0, escaped.length - 3],
    prompt: 'Only normal letters and underscores are allowed. Must end with \'__c\''
  })()
}

const promptRelationshipName = (label: string, forbiddenApiNames: string[]) => {
  const escaped = label.normalize('NFD').replace(/[\u0300-\u036f]|\s*/g, '')
  return prompt('Insert Relationship Api Name', v => {
    if (!(/^[[a-zA-Z0-9_]{3,40}(?<!_)$/.test(v))) { return 'Invalid Api Name. Must only use Uppercase or Lowercase Letters, numbers, underscores (\'_\'). Length must be between 3 and 40 chars' }
    if (forbiddenApiNames.indexOf(v) !== -1) { return 'Another Relationship with the same Api Name already exists on the object.' }
    return undefined
  }, undefined, {
    value: escaped,
    valueSelection: [0, escaped.length],
    prompt: 'Only normal letters and underscores are allowed'
  })()
}

const promptPrecision = async () => {
  const regex = new RegExp('^[0-9]{1,2},[0-9]{1,2}$')
  const res = await prompt('Insert Field Precision and Scale, separated by comma', v => {
    const [precision, scale] = v.split(',')
    if (!(regex.test(v)) || Number(precision) + Number(scale) > 18) { return 'Up to 18 digits are allowed, divided amongst digits to the left of the decimal point and digits to its right, in the format [digits to the left],[digits to the right]. i.e: 16,2' }
    return undefined
  }, undefined, {
    value: '18,0',
    valueSelection: [0, 2],
    prompt: 'Format is: [Number of digits to the left of the decimal point],[Number of digits to the right of the decimal point]'
  })()
  const [precision, scale] = res.split(',')
  return { precision, scale }
}

const promptDisplayFormat = prompt('Auto Number Display Format')

async function buildField (fieldConfig: any, existingFields: string[], allObjects: MyQuickPick[]) {
  const label = await promptLabel()
  const fullName = await promptApiName(label, existingFields)
  const defaultValue = fieldConfig.skipDefault ? undefined : await promptDefaultValue(fieldConfig.defaultOptions)
  const displayFormat = fieldConfig.showDisplayFormat ? await promptDisplayFormat() : undefined
  const externalId = fieldConfig.skipExternalId ? { externalId: false } : await promptIsExternalId(fieldConfig.type !== 'Number' && fieldConfig.type !== 'AutoNumber' && fieldConfig.type !== 'Lookup')
  const required = fieldConfig.skipRequired ? undefined : await promptRequired()
  const precData = fieldConfig.skipPrecision ? undefined : await promptPrecision()
  const unique = fieldConfig.skipUnique ? undefined : await promptIsUnique()
  const length = fieldConfig.skipLength ? undefined : await promptLength('Insert Field Maximum Length', fieldConfig.minLength, fieldConfig.maxLength, fieldConfig.lengthDefaultValue)
  const visibleLines = fieldConfig.showVisibleLines ? await promptLength('# Visible Lines', 1, 99, 3) : undefined
  const trackHistory = fieldConfig.trackHistory ? await promptTrackHistory() : undefined

  const referenceTo = fieldConfig.type === 'Lookup' ? await prompt('Insert the Referenced Object', undefined, allObjects)() : undefined
  const relationshipLabel = fieldConfig.type === 'Lookup' ? await promptRelationshipLabel() : undefined
  const relationshipName = fieldConfig.type === 'Lookup' ? await promptRelationshipName(relationshipLabel, []) : undefined
  const deleteConstraint = (
    fieldConfig.type === 'Lookup'
      ? (required
        ? 'Restrict'
        : await prompt('What to do if the lookup record is deleted?', undefined, [
          { label: 'Clear the value of this field.', value: 'SetNull' },
          { label: 'Don\'t allow deletion of the lookup record that\'s part of a lookup relationship.', value: 'Restrict' }
        ])()
      )
      : undefined
  )
  // description: string
  // inlineHelpText: string

  return {
    fullName,
    caseSensitive: externalId.caseSensitive,
    defaultValue: defaultValue !== null && defaultValue !== '' ? defaultValue : undefined,
    deleteConstraint,
    displayFormat,
    externalId: externalId.externalId,
    label,
    length,
    precision: precData?.precision,
    referenceTo,
    relationshipLabel,
    relationshipName,
    required,
    scale: precData?.scale,
    trackHistory,
    type: fieldConfig.type,
    unique,
    visibleLines
  }
}

export default (fieldType: string, existingFields: string[], trackHistory = false, allObjects: MyQuickPick[]) => {
  switch (fieldType) {
    case 'AutoNumber': return buildField({ showDisplayFormat: true, skipPrecision: true, trackHistory, skipLength: true, skipRequired: true, skipUnique: true, skipDefault: true, type: fieldType }, existingFields, allObjects)
    case 'Lookup': return buildField({ skipPrecision: true, skipExternalId: true, trackHistory, skipLength: true, skipUnique: true, skipDefault: true, type: fieldType }, existingFields, allObjects)
    case 'Checkbox': return buildField({ skipPrecision: true, trackHistory, skipLength: true, skipExternalId: true, skipRequired: true, skipUnique: true, defaultOptions: booleanOptions, type: fieldType }, existingFields, allObjects)
    case 'Text': return buildField({ skipPrecision: true, trackHistory, type: fieldType, minLength: 1, maxLength: 255, lengthDefaultValue: 255 }, existingFields, allObjects)
    case 'Email': return buildField({ skipPrecision: true, trackHistory, type: fieldType, skipLength: true }, existingFields, allObjects)
    case 'Number': return buildField({ trackHistory, type: fieldType, skipLength: true }, existingFields, allObjects)
    case 'Percent': return buildField({ trackHistory, type: fieldType, skipLength: true, skipExternalId: true, skipUnique: true }, existingFields, allObjects)
    case 'Currency': return buildField({ trackHistory, type: fieldType, skipLength: true, skipExternalId: true, skipUnique: true }, existingFields, allObjects)
    case 'Date': return buildField({ skipPrecision: true, trackHistory, skipLength: true, skipUnique: true, skipExternalId: true, type: fieldType }, existingFields, allObjects)
    case 'DateTime': return buildField({ skipPrecision: true, trackHistory, skipLength: true, skipUnique: true, skipExternalId: true, type: fieldType }, existingFields, allObjects)
    case 'Phone': return buildField({ skipPrecision: true, trackHistory, skipLength: true, skipUnique: true, skipExternalId: true, type: fieldType }, existingFields, allObjects)
    case 'TextArea': return buildField({ skipPrecision: true, trackHistory, skipLength: true, skipUnique: true, skipExternalId: true, type: fieldType }, existingFields, allObjects)
    case 'LongTextArea': return buildField({ skipDefault: true, showVisibleLines: true, skipRequired: true, skipPrecision: true, trackHistory, skipUnique: true, skipExternalId: true, minLength: 256, maxLength: 131072, lengthDefaultValue: 32768, type: fieldType }, existingFields, allObjects)
    case 'RichTextArea': return buildField({ skipDefault: true, showVisibleLines: true, skipRequired: true, skipPrecision: true, trackHistory, skipUnique: true, skipExternalId: true, minLength: 256, maxLength: 131072, lengthDefaultValue: 32768, type: fieldType }, existingFields, allObjects)
  }
}
