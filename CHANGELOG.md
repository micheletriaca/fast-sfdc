# Change Log
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
