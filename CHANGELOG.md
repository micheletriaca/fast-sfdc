# Change Log

## 1.13.4

* Bugfixing: fixed an error when retrieving profiles that contain `'`

## 1.13.3

* Bugfixing: fixed a regression in metadata explorer

## 1.13.2

* Updated `sfdy` to 1.7.3 to handle `Territory2*` metadata
* Added the possibility to specify a custom domain in User/Pwd authentication
* Updated vulnerable dependencies

## 1.13.1

* Bugfixing: [Credential selection modifies 'instanceUrl' parameter, causing subsequent commands to fail with 'Only absolute URLs are supported' error](issues/45)

## 1.13.0

* Faster saving of textual static resources using tooling API
* Minor bug fixing & dependencies update

## 1.12.0

* Open Salesforce setup directly from VSCode. Just click on the username on the status bar
* Faster `PermissionSet` retrieval

## 1.11.0

* Metadata explorer view: explore the metadata in your org, retrieve multiple components and add them to `package.xml`!
By default, you will see only the Metadata that is present in your org but that you haven't versioned yet, but by playing with the available filters you can see everything you want

* Fixed bug in Oauth2 authentication

## 1.10.1

* Fixed bug in soapLogin

## 1.10.0

* Minor bug fixing & dependencies update
* OAuth2 login flow

## 1.9.4

* Minor bug fixing & dependencies update

## 1.9.3

* Minor bug fixing

## 1.9.2

* Bugfixing: fixed create new checkbox field (defaultValue tag was missing when false)
* Updated `sfdy` to 1.5.2

## 1.9.1

* Bugfixing: fixed deployment of static resource bundle

## 1.9.0

* Added the possibility to skip some files from deploying and compiling. To do that, add for example `"excludeFiles": ["lwc/**/__tests__/**/*"]` to `.sfdy.json`

## 1.8.5

* Bugfixing

## 1.8.4

* Bug fixing: Fixed broken image links in `README.md`

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
* Bugfix compile LWC and AURA components in windows

## 1.7.0

* You can configure `Compile on save` from the `Manage Credentials` menu
* Added `Compile current file` command
* If you save a file multiple times and that file is currently compiling, only the last version of the file will be compiled on Salesforce instead of bloating the save queue

## 1.6.0

* `Create new... field`. From here you can create most of the supported field types for an object (Picklist and Multipicklist are on the road). The field creation wizard also handles FLS in profiles. Idea & Credits go to [tr4uma](https://github.com/tr4uma)

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

* Bugfixing: [Every Command in the palette is visible regardless of credential insertion](issues/21)
* Bugfixing: [Create new fails if package.xml hasn't any type](issues/20)
* Bugfixing: [Create new fails if the related metadata folder not exists](issues/19)
* Bugfixing: [Create new LWC. Init js-meta.xml file](issues/17)

## 1.3.2

* Bugfixing

## 1.3.1

* Bugfixing

## 1.3.0

* Static resource bundles ([#15](issues/15))
* Auto-add `fastsfdc.json` file to `.gitignore`. Thanks, [tr4uma](https://github.com/tr4uma)
* Added `execute anonymous` shortcut (`cmd+i e`)

## 1.2.0

* Bugfix: Duplicate .js-meta.xml resources in LWC bundle ([#13](issues/13))
* Configure `sfdy` environment during credential setup. It can be used in your custom plugins to do different things in different orgs (see [here](https://www.npmjs.com/package/sfdy#change-the-endpoint-of-a-named-credential-better-suited-as-a-predeployplugin-) for an example)
* Deploy multiple selected files in the explorer
* Retrieve multiple selected files in the explorer
* Delete (from local filesystem AND Salesforce) multiple selected files in explorer
* Delete from Salesforce removes the metadata also from `package.xml`
* The `Create new` command adds the metadata also in `package.xml`

## 1.1.0

* Initial release
