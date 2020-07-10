# Change Log
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
