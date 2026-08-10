export type DeploymentTestLevel =
  'RunLocalTests' |
  'RunSpecifiedTests' |
  'RunAllTestsInOrg' |
  'RunRelevantTests'

export const metadataRequiresTests = (value: boolean | string | undefined): boolean =>
  value === true || value === 'true'

export const productionTestLevels = (): DeploymentTestLevel[] => [
  'RunLocalTests',
  'RunRelevantTests',
  'RunSpecifiedTests',
  'RunAllTestsInOrg'
]
