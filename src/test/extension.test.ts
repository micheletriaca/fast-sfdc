//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert'
import { extractApexClassImports, extractInvalidApexClassNames, extractMissingFields, extractMissingRelationships } from '../utils/apex-errors'

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
})
