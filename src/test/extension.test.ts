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
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

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
      'auth', 'constants', 'deploy', 'format-adapters', 'package-utils', 'path-service',
      'retrieve', 'sfdc-utils', 'transformer', 'xml-utils'
    ]) {
      assert.doesNotThrow(() => requireModule(`sfdy/${entryPoint}`))
    }
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
})
