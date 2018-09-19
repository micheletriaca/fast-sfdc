import * as vscode from 'vscode'
import parsers from '../utils/parsers'
import utils from '../utils/utils'
import { AuraDefType, AuraFormat } from '../fast-sfdc'
import sfdcConnector from '../sfdc-connector'
import codeTemplates from '../utils/code-templates'
import statusbar from '../statusbar'
import * as path from 'path'

type AuraOption = { label: AuraDefType, format: AuraFormat }

const auraTypes: AuraOption[] = [
  { label: 'COMPONENT', format: 'XML' },
  { label: 'CONTROLLER', format: 'JS' },
  { label: 'HELPER', format: 'JS' },
  { label: 'STYLE', format: 'CSS' },
  { label: 'DOCUMENTATION', format: 'XML' },
  { label: 'RENDERER', format: 'JS' },
  { label: 'DESIGN', format: 'XML' },
  { label: 'SVG', format: 'XML' }
]

export default async function createAuraDefinition (docUri: vscode.Uri) {
  const lastFolder = parsers.getLastFolder(docUri)
  const existingTypes = (await utils.readdir(lastFolder)).map(parsers.getAuraDefType) as AuraDefType[]
  const selected = await vscode.window.showQuickPick(auraTypes.filter(x => !existingTypes.includes(x.label)))
  if (!selected) return

  statusbar.startLongJob(async done => {
    const bundleName = parsers.getAuraBundleName(docUri)
    const source = codeTemplates.getAuraTemplate(selected.label)

    const { AuraDefinitionBundleId } = await sfdcConnector.findAuraByNameAndDefType(
      parsers.getFilename(docUri.path),
      parsers.getAuraDefType(docUri.path)
    )

    await sfdcConnector.upsertAuraObj({
      DefType: selected.label,
      Format: selected.format,
      AuraDefinitionBundleId,
      Source: source
    })

    const filePath = path.join(parsers.getLastFolder(docUri), parsers.getAuraFileName(bundleName, selected.label))
    await utils.writeFile(filePath, source)
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(filePath)))

    done('👍🏻')
  })
}
