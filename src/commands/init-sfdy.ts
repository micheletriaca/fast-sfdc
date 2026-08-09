import * as vscode from 'vscode'
import configService from '../services/config-service'

export default async function initSfdy () {
  const sfdyCfg = configService.getSfdyConfigSync()
  if (!sfdyCfg.stored) {
    let currentVersion = ''
    try {
      currentVersion = await configService.getPackageXmlVersion()
    } catch (_) {}
    const apiVersion = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: 'Salesforce Metadata API version (for example 65.0)',
      value: currentVersion,
      validateInput: value => /^\d+\.0$/.test(value) ? null : 'Use a version such as 65.0'
    })
    if (!apiVersion) return
    configService.storeSfdyConfig({
      stored: true,
      apiVersion,
      objectTranslations: {
        stripUntranslatedFields: false,
        stripNotVersionedFields: false
      },
      preDeployPlugins: [],
      postRetrievePlugins: [],
      renderers: [],
      profiles: {
        addAllUserPermissions: false,
        addDisabledVersionedObjects: false,
        addExtraObjects: [],
        addExtraTabVisibility: [],
        addExtraApplications: [],
        stripUserPermissionsFromStandardProfiles: false,
        stripUnversionedStuff: false
      },
      roles: {
        stripPartnerRoles: false
      },
      staticResources: {
        useBundleRenderer: []
      },
      stripManagedPackageFields: [],
      excludeFiles: ['lwc/**/__tests__/**/*']
    })
  }
  const uri = vscode.Uri.file(configService.getSfdyConfigPath())
  vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri))
}
