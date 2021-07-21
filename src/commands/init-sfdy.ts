import * as vscode from 'vscode'
import configService from '../services/config-service'

export default async function initSfdy () {
  const sfdyCfg = configService.getSfdyConfigSync()
  if (!sfdyCfg.stored) {
    configService.storeSfdyConfig({
      stored: true,
      permissionSets: {
        stripUselessFls: true
      },
      objectTranslations: {
        stripUntranslatedFields: true,
        stripNotVersionedFields: true
      },
      preDeployPlugins: [],
      postRetrievePlugins: [],
      renderers: [],
      profiles: {
        addAllUserPermissions: false,
        addDisabledVersionedObjects: true,
        addExtraObjects: ['*', '!*__?'],
        addExtraTabVisibility: ['*', '!*__?'],
        addExtraApplications: ['standard__*'],
        stripUserPermissionsFromStandardProfiles: true,
        stripUnversionedStuff: true
      },
      roles: {
        stripPartnerRoles: true
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
