# Change Log

## 1.8.3
* Bugfixing: Fixed issues managing metadata in `wave` folder

## 1.8.2
* Bugfixing

## 1.8.1
* `Edit field level security` codelen does not add disabled permissions to a `PermissionSet` if `permissionsSets.stripUselessFls` is `true` in `.sfdy.json`
* `Edit field level security` codelen does not add permissions to a `Profile` if `profiles.addDisabledVersionedObjects` is `true` in `.sfdy.json` and the selected object is disabled in the `Profile`

## 1.8.0
* Added `Edit field level security` codelen when you open a `Profile` or a `PermissionSet`

## 1.7.1
* Bugfix create field when custom renderers are used
* Bugfix issue deploying ExperienceBundle
* Bugfix compile lwc and aura components in windows

## 1.7.0
* You can configure `Compile on save` from the `Manage Credentials` menu
* Added `Compile current file` command
* If you save a file multiple times and that file is currently compiling, only the last version of the file will be compiled on Salesforce instead of bloating the save queue

## 1.6.0
* `Create new... field`. From here you can create most of the supported field types for an object (Picklist and Multipicklist are on the road). The field creation wizard also handle FLS in profiles. Idea & Credits go to [tr4uma](https://github.com/tr4uma)

## 1.5.0
* New Unified `Manage Credentials` menu. From here you can fully manage your credentials:
  * Add credentials
  * Remove credentials
  * Replace current credentials
  * Switch credentials
* Click `fast-sfdc` status bar to open the `Manage Credentials` menu
* `vscode` builtin spinner icon
* LWC filename validation
* Create HTML file along with the LWC (thanks [makostas1996](https://github.com/makostas1996))

## 1.4.6
* Bugfixing

## 1.4.5
* Bugfixing: Flush telemetry logs

## 1.4.4
* Telemetry: Add super simple anonymous telemetry to monitor usage/bugs

## 1.4.3
* Bugfixing: Fixed broken `Deploy metadata` command

## 1.4.2
* Bugfixing

## 1.4.1
* Bugfixing

## 1.4.0
* Added `Delete credentials` command. Thanks [makostas1996](https://github.com/makostas1996)
* Bugfixing

## 1.3.6
* Updated `sfdy` to v1.3.6

## 1.3.5
* Updated `sfdy` to v1.3.4

## 1.3.4
* Bugfixing: [Windows compatibility](issues/22)
* Bugfixing: Better handling of session token expiration

## 1.3.3
* Bugfixing: [Every Command in palette is visible regardless of credential insertion](issues/21)
* Bugfixing: [Create new fails if package.xml hasn't any type](issues/20)
* Bugfixing: [Create new fails if related metadata folder not exists](issues/19)
* Bugfixing: [Create new lwc. Init js-meta.xml file](issues/17)

## 1.3.2
* Bugfixing

## 1.3.1
* Bugfixing

## 1.3.0
* Static resource bundles ([#15](issues/15))
* Auto-add `fastsfdc.json` file to `.gitignore`. Thanks [tr4uma](https://github.com/tr4uma)
* Added `execute anonymous` shortcut (`cmd+i e`)

## 1.2.0
* Bugfix: Duplicate .js-meta.xml resources in LWC bundle ([#13](issues/13))
* Configure `sfdy` environment during credential setup. It can be used in your custom plugins to do different things in different orgs (see [here](https://www.npmjs.com/package/sfdy#change-the-endpoint-of-a-named-credential-better-suited-as-a-predeployplugin-) for an example)
* Deploy multiple selected files in explorer
* Retrieve multiple selected files in explorer
* Delete (from local filesystem AND from Salesforce) multiple selected files in explorer
* Delete from Salesforce removes the metadata also from `package.xml`
* `Create new` command adds the metadata also in `package.xml`

## 1.1.0
* Initial release
