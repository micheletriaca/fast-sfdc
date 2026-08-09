//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert'
import { createRequire } from 'module'
import { suite, test } from 'node:test'
import { extractApexClassImports, extractInvalidApexClassNames, extractInvalidSObjectFields, extractMissingApexVariables, extractMissingFields, extractMissingRelationships } from '../utils/apex-errors'
import { resolveSourceLayout } from '../services/source-layout-service'
import { buildMetadataTree, getSelectionState } from '../services/metadata-tree-service'
import { getMetadataComponentAliases } from '../services/metadata-component-aliases'
import { getComponentModel } from 'sfdy/format-adapters'
import { fromSharedCredential, toSharedCredential, toStoredFastConfig } from '../services/credential-bridge'
import { buildRefreshTokenRequest } from '../services/oauth-utils'
import * as constants from 'sfdy/constants'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { credentialLabel, environmentIsAvailable } from '../services/credential-label-service'
import { buildPluginRecipe } from '../services/plugin-recipe-service'

const requireModule = createRequire(__filename)

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as vscode from 'vscode';
// import * as myExtension from '../extension';

// Defines a Mocha test suite to group tests of similar kind together
suite('Extension Tests', function () {
  // Defines a Mocha unit test
  test('Something 1', function () {
    assert.equal(-1, [1, 2, 3].indexOf(5))
    assert.equal(-1, [1, 2, 3].indexOf(0))
  })

  test('Extracts invalid Apex dependency chains', function () {
    const error = new Error(
      'FIELD_INTEGRITY_EXCEPTION: Dependent class is invalid and needs recompilation:\n' +
      ' Class CtrlDealerData : Dependent class is invalid and needs recompilation:\n' +
      " Class PermissionsManager : No such relation 'Contact' on entity 'User'."
    )

    assert.deepEqual(extractInvalidApexClassNames(error), ['CtrlDealerData', 'PermissionsManager'])
  })

  test('Ignores unrelated compiler errors', function () {
    assert.deepEqual(extractInvalidApexClassNames(new Error('Unknown field RecordTypeId')), [])
  })

  test('Extracts Apex classes imported directly by an LWC', function () {
    const source = `
      import first from '@salesforce/apex/CtrlAddressBeautifier.getAddress'
      import second from "@salesforce/apex/CtrlAddressBeautifier.save"
      import third from '@salesforce/apex/SharingEngine.getCurrentUserDealerId'
      import managed from '@salesforce/apex/ns.ManagedController.run'
    `

    assert.deepEqual(extractApexClassImports(source), [
      'CtrlAddressBeautifier',
      'SharingEngine',
      'ns.ManagedController'
    ])
  })

  test('Extracts missing schema relationships', function () {
    const error = new Error("No such relation 'Contact' on entity 'User'.")
    assert.deepEqual(extractMissingRelationships(error), [{
      relationshipName: 'Contact',
      entityName: 'User'
    }])
  })

  test('Extracts missing schema fields', function () {
    const error = new Error("No such column 'DeveloperName' on entity 'RecordType'.")
    assert.deepEqual(extractMissingFields(error), [{
      fieldName: 'DeveloperName',
      entityName: 'RecordType'
    }])
  })

  test('Extracts invalid sObject field references', function () {
    const error = new Error(
      'Invalid reference Product2.MaterialApplications__c of type sobjectField in file adpRules.js\n' +
      'Invalid reference OptionRule__c.RuleType__c of type sobjectField in file adpRules.js\n' +
      'Invalid reference Product2.MaterialOrColorType__c of type sobjectField in file adpRules.js'
    )
    assert.deepEqual(extractInvalidSObjectFields(error), [{
      entityName: 'Product2',
      fieldName: 'MaterialApplications__c'
    }, {
      entityName: 'OptionRule__c',
      fieldName: 'RuleType__c'
    }, {
      entityName: 'Product2',
      fieldName: 'MaterialOrColorType__c'
    }])
  })

  test('Extracts variables missing from the Apex compiler context', function () {
    const error = new Error('FIELD_INTEGRITY_EXCEPTION: Variable does not exist: Profile: Source [Source]')
    assert.deepEqual(extractMissingApexVariables(error), ['Profile'])
  })

  test('Loads sfdy through its public entry points', function () {
    for (const entryPoint of [
      'auth', 'constants', 'credentials', 'deploy', 'format-adapters', 'package-utils', 'path-service',
      'retrieve', 'sfdc-utils', 'transformer', 'xml-utils'
    ]) {
      assert.doesNotThrow(() => requireModule(`sfdy/${entryPoint}`))
    }
  })

  test('Maps OAuth credentials to and from the shared sfdy vault', function () {
    const shared = toSharedCredential({
      id: 'credential-id',
      alias: 'acme-dev',
      type: 'oauth2',
      username: 'developer@example.com',
      password: 'refresh-token',
      instanceUrl: 'https://acme.my.salesforce.com',
      environment: 'dev',
      deployOnSave: true
    })
    assert.strictEqual(shared.refreshToken, 'refresh-token')
    assert.strictEqual(shared.password, undefined)

    const hydrated = fromSharedCredential({
      ...shared,
      id: 'credential-id',
      alias: 'acme-dev'
    }, { deployOnSave: true })
    assert.strictEqual(hydrated.password, 'refresh-token')
    assert.strictEqual(hydrated.type, 'oauth2')
    assert.strictEqual(hydrated.deployOnSave, true)
  })

  test('Stores only the active credential and deploy-on-save preferences locally', function () {
    assert.deepEqual(toStoredFastConfig({
      stored: true,
      currentCredential: 1,
      credentials: [{
        id: 'dev-id',
        alias: 'dev',
        username: 'developer@example.com',
        password: 'secret',
        instanceUrl: 'https://example.my.salesforce.com',
        environment: 'dev',
        type: 'oauth2',
        deployOnSave: false
      }, {
        id: 'uat-id',
        alias: 'uat',
        username: 'developer@example.com.uat',
        password: 'another-secret',
        deployOnSave: true
      }]
    }), {
      currentCredentialId: 'uat-id',
      credentialSettings: {
        'dev-id': { deployOnSave: false },
        'uat-id': { deployOnSave: true }
      }
    })
  })

  test('Labels credentials by environment and allows duplicate usernames', function () {
    const credentials = [{ id: 'dev-id', environment: 'dev', username: 'same@example.com' }, {
      id: 'uat-id', environment: 'uat', username: 'same@example.com'
    }]
    assert.strictEqual(credentialLabel(credentials[0]), 'dev - same@example.com')
    assert.strictEqual(environmentIsAvailable(credentials, 'prod'), true)
    assert.strictEqual(environmentIsAvailable(credentials, 'DEV'), false)
    assert.strictEqual(environmentIsAvailable(credentials, 'dev', credentials[0]), true)
  })

  test('Generates environment-aware sfdy plugin recipes', function () {
    const generated = buildPluginRecipe('environment-endpoints', ['uat', 'dev', 'dev'])
    assert.strictEqual(generated.relativePath, 'sfdy-plugins/environment-endpoints.js')
    assert.deepEqual(generated.configuration, {
      gitUrl: 'https://service.example.invalid',
      urlsByEnvironment: {
        dev: 'TODO: set endpoint for dev',
        uat: 'TODO: set endpoint for uat'
      }
    })
    assert.match(generated.source, /stage: 'metadata'/)
    assert.match(generated.source, /target\.environment/)
    assert.match(generated.source, /namedCredentials\/\*\.namedCredential/)
    assert.match(generated.source, /^\/\*\*[\s\S]*dev can use a test server while prod uses the real server/)
    for (const recipe of ['environment-endpoints', 'workflow-emails', 'custom-metadata-values'] as const) {
      const module = { exports: {} as any }
      // eslint-disable-next-line no-new-func
      Function('require', 'module', 'exports', buildPluginRecipe(recipe, ['dev']).source)(requireModule, module, module.exports)
      assert.strictEqual(module.exports.apiVersion, 2)
    }
  })

  test('Generated endpoint plugin remaps deploy values', async function () {
    const generated = buildPluginRecipe('environment-endpoints', ['dev'])
    const module = { exports: {} as any }
    // eslint-disable-next-line no-new-func
    Function('require', 'module', 'exports', generated.source)(requireModule, module, module.exports)
    const { FileTree } = requireModule('sfdy/plugin')
    const tree = new FileTree({
      files: [{
        path: 'namedCredentials/Backend.namedCredential',
        contents: '<NamedCredential xmlns="http://soap.sforce.com/2006/04/metadata"><endpoint>https://service.example.invalid</endpoint></NamedCredential>'
      }]
    })
    await module.exports.onDeploy({
      files: tree.files,
      target: { environment: 'dev' },
      config: {
        pluginRecipes: {
          environmentEndpoints: {
            gitUrl: 'https://service.example.invalid',
            urlsByEnvironment: { dev: 'https://dev.example.com' }
          }
        }
      },
      log: { info: (message: string) => assert.ok(message) }
    })
    assert.match(
      await tree.files.get('namedCredentials/Backend.namedCredential').readText(),
      /https:\/\/dev\.example\.com/
    )
  })

  test('Omits an unavailable client secret from refresh-token requests', function () {
    assert.deepEqual(buildRefreshTokenRequest({
      type: 'oauth2',
      password: 'refresh-token'
    }), {
      grant_type: 'refresh_token',
      client_id: constants.DEFAULT_CLIENT_ID,
      refresh_token: 'refresh-token'
    })

    assert.strictEqual(buildRefreshTokenRequest({
      type: 'oauth2',
      password: 'refresh-token',
      clientSecret: 'connected-app-secret'
    }).client_secret, 'connected-app-secret')
  })

  test('Resolves a standard source-format project without package.xml', function () {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-sfdc-layout-'))
    try {
      fs.mkdirSync(path.join(root, 'force-app', 'main', 'default'), { recursive: true })
      fs.writeFileSync(path.join(root, 'sfdx-project.json'), JSON.stringify({
        packageDirectories: [{ path: 'force-app', default: true }],
        sourceApiVersion: '65.0'
      }))
      const layout = resolveSourceLayout(root, { stored: true, sourceFormat: 'sfdx' })
      assert.equal(layout.relativeRoot, 'force-app/main/default')
      assert.equal(layout.apiVersion, '65.0')
      assert.equal(
        layout.toRelativePath(path.join(root, 'force-app', 'main', 'default', 'classes', 'Example.cls')),
        'classes/Example.cls'
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('Resolves a metadata project without package.xml', function () {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-sfdc-metadata-layout-'))
    try {
      const layout = resolveSourceLayout(root, {
        stored: true,
        sourceFormat: 'metadata',
        apiVersion: '65.0'
      })
      assert.equal(layout.relativeRoot, 'src')
      assert.equal(layout.apiVersion, '65.0')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('Builds semantic child metadata under its container', function () {
    const tree = buildMetadataTree([
      { type: 'ApexClass', fullName: 'Example' },
      { type: 'CustomObject', fullName: 'Invoice__c' },
      { type: 'CustomField', fullName: 'Invoice__c.Status__c' },
      { type: 'ValidationRule', fullName: 'Invoice__c.RequiredAmount' },
      { type: 'CustomFieldTranslation', fullName: 'Invoice__c-it.Status__c' }
    ], getComponentModel())

    assert.deepEqual(tree.map(node => node.label), [
      'ApexClass',
      'CustomObject',
      'CustomObjectTranslation'
    ])
    const object = tree[1].children[0]
    assert.equal(object.label, 'Invoice__c')
    assert.equal(object.operationComponent?.type, 'CustomObject')
    assert.deepEqual(object.children.map(node => node.label), ['fields', 'object metadata', 'validationRules'])
    const fields = object.children.find(node => node.label === 'fields')
    assert.deepEqual(fields?.children[0], {
      key: 'CustomField/Invoice__c.Status__c',
      label: 'Status__c',
      component: { type: 'CustomField', fullName: 'Invoice__c.Status__c' },
      operationComponent: { type: 'CustomField', fullName: 'Invoice__c.Status__c' },
      children: []
    })
    assert.deepEqual(object.children.find(node => node.label === 'object metadata'), {
      key: 'CustomObject/Invoice__c#root',
      label: 'object metadata',
      component: { type: 'CustomObject', fullName: 'Invoice__c' },
      operationComponent: { type: 'CustomObject', fullName: 'Invoice__c', scope: 'root' },
      children: []
    })
    const translations = tree[2].children[0]
    const translatedFields = translations.children.find(node => node.label === 'fields')
    assert.deepEqual(translatedFields?.children[0].operationComponent, {
      type: 'CustomObjectTranslation',
      fullName: 'Invoice__c-it'
    })
  })

  test('Builds folder metadata inside its content type', function () {
    const tree = buildMetadataTree([
      { type: 'ReportFolder', fullName: 'Sales' },
      { type: 'ReportFolder', fullName: 'Sales/Quarterly' },
      { type: 'Report', fullName: 'Sales/Pipeline' },
      { type: 'Report', fullName: 'Sales/Quarterly/Forecast' },
      { type: 'DashboardFolder', fullName: 'Operations' }
    ], getComponentModel())

    assert.deepEqual(tree.map(node => node.label), ['Dashboard', 'Report'])
    const reportRoot = tree[1]
    const sales = reportRoot.children[0]
    assert.equal(sales.label, 'Sales')
    assert.equal(sales.component, undefined)
    assert.equal(sales.operationComponent, undefined)
    assert.deepEqual(sales.children.map(node => node.label), ['[FOLDER METADATA]', 'Pipeline', 'Quarterly'])

    const salesMetadata = sales.children[0]
    assert.deepEqual(salesMetadata.component, { type: 'ReportFolder', fullName: 'Sales' })
    assert.deepEqual(salesMetadata.operationComponent, { type: 'Report', fullName: 'Sales/' })

    const quarterly = sales.children[2]
    assert.equal(quarterly.component, undefined)
    assert.deepEqual(quarterly.children[0].component, {
      type: 'ReportFolder',
      fullName: 'Sales/Quarterly'
    })
    assert.deepEqual(quarterly.children[0].operationComponent, {
      type: 'Report',
      fullName: 'Sales/Quarterly/'
    })
    assert.deepEqual(quarterly.children.map(node => node.label), ['[FOLDER METADATA]', 'Forecast'])

    assert.equal(getSelectionState(sales, new Set(['ReportFolder/Sales'])), 'some')
    assert.equal(getSelectionState(sales, new Set([
      'ReportFolder/Sales',
      'ReportFolder/Sales/Quarterly',
      'Report/Sales/Pipeline',
      'Report/Sales/Quarterly/Forecast'
    ])), 'all')
  })

  test('Keeps a selected container partial when only some descendants are selected', function () {
    const object = {
      key: 'CustomObject/ForecastingAsset__c',
      label: 'ForecastingAsset__c',
      component: { type: 'CustomObject', fullName: 'ForecastingAsset__c' },
      children: [{
        key: 'group/fields',
        label: 'fields',
        children: [
          {
            key: 'CustomField/ForecastingAsset__c.Period__c',
            label: 'Period__c',
            component: { type: 'CustomField', fullName: 'ForecastingAsset__c.Period__c' },
            children: []
          },
          {
            key: 'CustomField/ForecastingAsset__c.Notes__c',
            label: 'Notes__c',
            component: { type: 'CustomField', fullName: 'ForecastingAsset__c.Notes__c' },
            children: []
          }
        ]
      }]
    }

    assert.equal(getSelectionState(object, new Set([
      'CustomObject/ForecastingAsset__c',
      'CustomField/ForecastingAsset__c.Period__c'
    ])), 'some')
  })

  test('Normalizes person account record type aliases returned by Metadata API', function () {
    const aliases = getMetadataComponentAliases([
      {
        DeveloperName: 'Individual',
        IsPersonType: true,
        SobjectType: 'Account'
      },
      {
        DeveloperName: 'Business',
        IsPersonType: false,
        SobjectType: 'Account'
      }
    ])

    assert.equal(aliases.get('RecordType/Account.Individual'), 'PersonAccount.Individual')
    assert.equal(aliases.has('RecordType/Account.Business'), false)
  })
})
