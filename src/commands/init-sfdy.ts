import * as vscode from 'vscode'
import configService from '../services/config-service'

export default async function initSfdy () {
  const sfdyCfg = configService.getSfdyConfigSync()
  if (!sfdyCfg.stored) {
    configService.storeSfdyConfig({
      stored: true,
      permissionSets: {
        stripUselessFls: false
      },
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
