import * as vscode from 'vscode'
import utils from '../utils/utils'
import * as path from 'upath'
import { readFileSync, writeFileSync } from 'fs'

interface Label { fullName: string[]; categories: string[]|null; language: string[]|null, protected: string[]|null, shortDescription: string[]|null, value: string[] }
async function chooseType (options:string[]): Promise<string|undefined> {
  return new Promise((resolve) => {
    const quickPick = vscode.window.createQuickPick()
    const choices = options.map(choice => ({ label: choice }))
    quickPick.items = choices
    quickPick.title = 'Category'
    quickPick.onDidChangeValue(() => {
      if (!options.includes(quickPick.value)) quickPick.items = [{ label: quickPick.value }, ...choices]
    })
    quickPick.onDidAccept(() => {
      const selection = quickPick.activeItems[0]
      resolve(selection.label)
      quickPick.hide()
    })
    quickPick.show()
  })
}

export default async function createLabel () {
  try {
    const customLabelsUri = path.join(utils.getWorkspaceFolder(), 'src/labels/CustomLabels.labels')
    const labelsXml = await utils.parseXml(readFileSync(customLabelsUri))
    const labelApiNames = new Set(labelsXml.CustomLabels.labels.map((l:Label) => l.fullName[0]))

    const labelName = await utils.inputText('enter label ApiName', '', {
      validateInput: v => {
        if (!/[A-Z][a-zA-Z0-9]*$/.test(v)) {
          return `Wrong Label Api Name
            Should begin with a capital Letter and contain only alphanumeric characters`
        }
        if (labelApiNames.has(v)) {
          return 'ApiName already exists'
        }
        return null
      }
    })
    if (!labelName) return
    const value = await utils.inputText('enter label Value', '')
    if (!value) return
    const options:string[] = Array.from(new Set(labelsXml.CustomLabels.labels.map((l:Label) => { return l.categories ? l.categories[0] : null }))).filter((l) => !!l)
    const cat = await chooseType(options)
    const desc = await utils.inputText('enter label Description', '')
    const lang = await utils.inputText('enter label Language', 'en-US')
    if (!lang) return
    const importLabel = await vscode.window.showQuickPick([{ label: 'Yes', value: true }, { label: 'No' }], { ignoreFocusOut: true, title: `Do you want to import label to labels${labelName[0].toLowerCase() <= 'k' ? 'AK' : 'LZ'}.js` })
    if (!importLabel) return

    labelsXml.CustomLabels.labels.push({
      fullName: [labelName],
      categories: [cat] || [],
      language: [lang],
      protected: ['false'],
      shortDescription: [desc],
      value: [value]
    })
    labelsXml.CustomLabels.labels.sort((a:Label, b:Label) => (a.fullName[0].toLowerCase() < b.fullName[0].toLowerCase() ? -1 : 1))
    writeFileSync(customLabelsUri, utils.buildXml(labelsXml))

    if (importLabel?.value) {
      const filename = `labels${labelName[0].toLowerCase() <= 'k' ? 'AK' : 'LZ'}`
      const filepath = path.join(utils.getWorkspaceFolder(), `src/lwc/${filename}/${filename}.js`)
      const fileData = String.fromCharCode(...readFileSync(filepath))
      const jsLabels = [...fileData.matchAll(/(?:import )(?<name>\w*)(?: from '@salesforce\/label\/c.)(?<object>.*)(?:')/g)].map(l => l.groups)
      jsLabels.push({ name: labelName, object: labelName })
      jsLabels.sort((a, b) => { return (a?.name.toLowerCase() || '') < (b?.name.toLowerCase() || '') ? -1 : 1 })
      let newData = ''
      jsLabels.forEach(l => {
        newData += `import ${l?.name} from '@salesforce/label/c.${l?.object}'\n`
      })
      newData += '\nexport default {\n'
      jsLabels.forEach((l, idx) => {
        newData += `  ${l?.name}${idx < jsLabels.length - 1 ? ',' : ''}\n`
      })
      newData += '}'
      await writeFileSync(filepath, newData)
    }
    vscode.window.showInformationMessage(`Label ${labelName} has been Created`)
  } catch (e) {
    vscode.window.showErrorMessage('An Error occured: \n' + e.message)
  }
}
