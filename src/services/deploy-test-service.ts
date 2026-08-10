import * as vscode from 'vscode'
import sfdcConnector from '../sfdc-connector'
import logger from '../logger'
import { DeploymentTestLevel, metadataRequiresTests, productionTestLevels } from './deploy-test-options'

export interface DeploymentTestSelection {
  proceed: boolean;
  testRequired: boolean;
  testLevel?: DeploymentTestLevel;
  specifiedTests?: string;
}

const descriptions: Record<DeploymentTestLevel, {label: string; description: string}> = {
  RunLocalTests: {
    label: 'Run local tests',
    description: 'Salesforce default: excludes tests from installed packages'
  },
  RunRelevantTests: {
    label: 'Run relevant tests (Beta)',
    description: 'Salesforce selects tests related to the deployment'
  },
  RunSpecifiedTests: {
    label: 'Run specified tests',
    description: 'Run only selected test classes; per-component coverage rules apply'
  },
  RunAllTestsInOrg: {
    label: 'Run all tests in org',
    description: 'Includes tests from installed managed packages'
  }
}

const normalizeSpecifiedTests = (value: string): string => value
  .split(',')
  .map(test => test.trim())
  .filter(Boolean)
  .join(',')

export const chooseProductionDeployTests = async (): Promise<DeploymentTestSelection> => {
  let testRequired = true
  let requirementUnknown = false
  try {
    const metadataDescription = await sfdcConnector.describeMetadata()
    testRequired = metadataRequiresTests(metadataDescription.testRequired)
  } catch (error) {
    requirementUnknown = true
    logger.appendLine(`Unable to determine whether Apex tests are required: ${error.message}`)
  }

  if (!testRequired) return { proceed: true, testRequired: false }

  const selected = await vscode.window.showQuickPick(
    productionTestLevels().map(value => ({ ...descriptions[value], value })),
    {
      ignoreFocusOut: true,
      title: requirementUnknown
        ? 'Apex test requirements could not be determined; choose a safe test level'
        : 'Apex tests are required for this production deployment',
      placeHolder: 'Select the Apex test level'
    }
  )
  if (!selected) return { proceed: false, testRequired: true }

  if (selected.value !== 'RunSpecifiedTests') {
    return { proceed: true, testRequired: true, testLevel: selected.value }
  }

  const specifiedTests = await vscode.window.showInputBox({
    ignoreFocusOut: true,
    title: 'Apex tests to run',
    prompt: 'Enter comma-separated Apex test class names',
    validateInput: value => normalizeSpecifiedTests(value) ? null : 'Enter at least one Apex test class'
  })
  if (specifiedTests === undefined) return { proceed: false, testRequired: true }
  const normalizedTests = normalizeSpecifiedTests(specifiedTests)
  if (!normalizedTests) return { proceed: false, testRequired: true }
  return {
    proceed: true,
    testRequired: true,
    testLevel: selected.value,
    specifiedTests: normalizedTests
  }
}
