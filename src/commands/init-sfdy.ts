import * as fs from 'fs'
import * as vscode from 'vscode'
import * as path from 'path'

export default async function initSfdy () {
  const sfdyPath = path.join(vscode.workspace.rootPath || '', '.sfdy.json')
  if (!fs.existsSync(sfdyPath)) {
    fs.writeFileSync(sfdyPath, JSON.stringify({
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
      stripManagedPackageFields: []
    }, null, 2))
  }
  vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(sfdyPath)))
}
