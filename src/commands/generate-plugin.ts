import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import configService from '../services/config-service'
import utils from '../utils/utils'
import { credentialEnvironment } from '../services/credential-label-service'
import { buildPluginRecipe, PluginRecipeId, pluginRecipes } from '../services/plugin-recipe-service'
import { resolveSourceLayout } from '../services/source-layout-service'

const appendOnce = (values: string[] | undefined, value: string): string[] =>
  values?.includes(value) ? values : [...(values || []), value]

export default async function generatePlugin () {
  const selection = await vscode.window.showQuickPick(pluginRecipes.map(recipe => ({
    label: recipe.label,
    description: recipe.description,
    recipeId: recipe.id
  })), {
    ignoreFocusOut: true,
    placeHolder: 'Generate a ready-to-edit sfdy plugin'
  })
  if (!selection) return

  const fastConfig = await configService.getConfig()
  const environments = fastConfig.credentials.map(credentialEnvironment)
  const generated = buildPluginRecipe(selection.recipeId as PluginRecipeId, environments)
  const workspaceRoot = utils.getWorkspaceFolder()
  const pluginPath = path.resolve(workspaceRoot, generated.relativePath)
  if (fs.existsSync(pluginPath)) {
    vscode.window.showWarningMessage(`${generated.relativePath} already exists; Fast-Sfdc did not overwrite it.`)
    return vscode.window.showTextDocument(await vscode.workspace.openTextDocument(pluginPath))
  }

  const sfdyConfig = configService.getSfdyConfigSync()
  if (!sfdyConfig.stored) {
    const layout = resolveSourceLayout(workspaceRoot, sfdyConfig)
    sfdyConfig.sourceFormat = layout.isSourceFormat ? 'sfdx' : 'metadata'
    sfdyConfig.apiVersion = layout.apiVersion || await configService.getPackageXmlVersion()
  }
  sfdyConfig.pluginRecipes = {
    ...(sfdyConfig.pluginRecipes || {}),
    [generated.recipe.configKey]: generated.configuration
  }
  sfdyConfig.preDeployPlugins = appendOnce(sfdyConfig.preDeployPlugins, generated.relativePath)
  sfdyConfig.postRetrievePlugins = appendOnce(sfdyConfig.postRetrievePlugins, generated.relativePath)

  await utils.writeFile(pluginPath, generated.source)
  await configService.storeSfdyConfig(sfdyConfig)
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(pluginPath))
  vscode.window.showInformationMessage(
    `Generated ${generated.relativePath}. Replace the TODO values in .sfdy.json before deploying.`
  )
}
