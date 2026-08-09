export type PluginRecipeId = 'environment-endpoints' | 'workflow-emails' | 'custom-metadata-values'

export interface PluginRecipe {
  id: PluginRecipeId;
  label: string;
  description: string;
  fileName: string;
  configKey: string;
}

export interface GeneratedPluginRecipe {
  recipe: PluginRecipe;
  relativePath: string;
  source: string;
  configuration: Record<string, unknown>;
}

export const pluginRecipes: PluginRecipe[] = [{
  id: 'environment-endpoints',
  label: 'Environment endpoints',
  description: 'Remap Named Credential and Remote Site endpoints for each environment.',
  fileName: 'environment-endpoints.js',
  configKey: 'environmentEndpoints'
}, {
  id: 'workflow-emails',
  label: 'Workflow email recipients',
  description: 'Remap literal email recipients in Workflow metadata for each environment.',
  fileName: 'workflow-email-recipients.js',
  configKey: 'workflowEmails'
}, {
  id: 'custom-metadata-values',
  label: 'Custom Metadata value',
  description: 'Remap one canonical value in selected Custom Metadata records.',
  fileName: 'custom-metadata-values.js',
  configKey: 'customMetadataValues'
}]

const valuesByEnvironment = (environments: string[], description: string): Record<string, string> =>
  Object.fromEntries(environments.map(environment => [environment, `TODO: ${description} for ${environment}`]))

const endpointSource = `/**
 * Changes Named Credential and Remote Site URLs before deploying.
 * For example, dev can use a test server while prod uses the real server.
 * After a retrieve, it puts the shared URL stored in Git back into the files.
 */
const { definePlugin } = require('sfdy/plugin')

const endpointFiles = [
  'namedCredentials/*.namedCredential',
  'remoteSiteSettings/*.remoteSite'
]

const readUrls = (config, environment) => {
  const settings = config.pluginRecipes?.environmentEndpoints
  const environmentUrl = settings?.urlsByEnvironment?.[environment]

  if (!settings?.gitUrl || !environmentUrl || environmentUrl.startsWith('TODO:')) {
    throw new Error(\`Set pluginRecipes.environmentEndpoints for environment '\${environment}'\`)
  }

  return { gitUrl: settings.gitUrl, environmentUrl }
}

const changeEndpoints = async (files, oldUrl, newUrl) => {
  for (const file of files.match('namedCredentials/*.namedCredential')) {
    const metadata = await file.readXml()
    if (metadata.endpoint?.[0] === oldUrl) metadata.endpoint = [newUrl]
    await file.writeXml(metadata)
  }

  for (const file of files.match('remoteSiteSettings/*.remoteSite')) {
    const metadata = await file.readXml()
    if (metadata.url?.[0] === oldUrl) metadata.url = [newUrl]
    await file.writeXml(metadata)
  }
}

module.exports = definePlugin({
  name: 'environment-endpoints',
  stage: 'metadata',
  formats: ['metadata', 'sfdx'],

  enabled: ({ config, files }) =>
    !!config.pluginRecipes?.environmentEndpoints &&
    (!files || files.match(endpointFiles).length > 0),

  async onDeploy ({ files, target, config, log }) {
    const urls = readUrls(config, target.environment)
    await changeEndpoints(files, urls.gitUrl, urls.environmentUrl)
    log.info(\`Using \${target.environment} endpoints\`)
  },

  async onRetrieve ({ files, target, config }) {
    const urls = readUrls(config, target.environment)
    await changeEndpoints(files, urls.environmentUrl, urls.gitUrl)
  }
})
`

const workflowSource = `/**
 * Changes email addresses found in Workflow files before deploying.
 * For example, dev can send emails to a test mailbox while prod uses the real recipients.
 * After a retrieve, it puts the shared email address stored in Git back into the files.
 */
const { definePlugin } = require('sfdy/plugin')

const readEmails = (config, environment) => {
  const settings = config.pluginRecipes?.workflowEmails
  const environmentEmail = settings?.emailsByEnvironment?.[environment]

  if (!settings?.gitEmail || !environmentEmail || environmentEmail.startsWith('TODO:')) {
    throw new Error(\`Set pluginRecipes.workflowEmails for environment '\${environment}'\`)
  }

  return {
    filePatterns: settings.files || 'workflows/*.workflow',
    gitEmail: settings.gitEmail,
    environmentEmail
  }
}

// Workflow recipients can be nested in different XML blocks.
// Walk the parsed XML and replace only values that exactly match the old email.
const replaceEmail = (value, oldEmail, newEmail) => {
  if (typeof value === 'string') return value === oldEmail ? newEmail : value
  if (Array.isArray(value)) return value.map(item => replaceEmail(item, oldEmail, newEmail))

  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      value[key] = replaceEmail(value[key], oldEmail, newEmail)
    }
  }

  return value
}

const changeWorkflowEmails = async (files, filePatterns, oldEmail, newEmail) => {
  for (const file of files.match(filePatterns)) {
    const workflow = await file.readXml()
    replaceEmail(workflow, oldEmail, newEmail)
    await file.writeXml(workflow)
  }
}

module.exports = definePlugin({
  name: 'workflow-email-recipients',
  stage: 'metadata',
  formats: ['metadata', 'sfdx'],

  enabled: ({ config, files }) => {
    const settings = config.pluginRecipes?.workflowEmails
    return !!settings && (!files || files.match(settings.files || 'workflows/*.workflow').length > 0)
  },

  async onDeploy ({ files, target, config, log }) {
    const emails = readEmails(config, target.environment)
    await changeWorkflowEmails(files, emails.filePatterns, emails.gitEmail, emails.environmentEmail)
    log.info(\`Using \${target.environment} Workflow email recipients\`)
  },

  async onRetrieve ({ files, target, config }) {
    const emails = readEmails(config, target.environment)
    await changeWorkflowEmails(files, emails.filePatterns, emails.environmentEmail, emails.gitEmail)
  }
})
`

const customMetadataSource = `/**
 * Changes one text field in the selected Custom Metadata records before deploying.
 * For example, the same setting can have a test value in dev and a real value in prod.
 * After a retrieve, it puts the shared value stored in Git back into the files.
 */
const { definePlugin } = require('sfdy/plugin')

const readValues = (config, environment) => {
  const settings = config.pluginRecipes?.customMetadataValues
  const environmentValue = settings?.valuesByEnvironment?.[environment]

  if (!settings?.field || settings.field.startsWith('TODO:') ||
      !settings?.gitValue || !environmentValue || environmentValue.startsWith('TODO:')) {
    throw new Error(\`Set pluginRecipes.customMetadataValues for environment '\${environment}'\`)
  }

  return {
    filePatterns: settings.files || 'customMetadata/*.md',
    field: settings.field,
    gitValue: settings.gitValue,
    environmentValue
  }
}

const changeCustomMetadataValues = async (files, filePatterns, fieldName, oldValue, newValue) => {
  for (const file of files.match(filePatterns)) {
    const metadata = await file.readXml()

    for (const fieldValue of metadata.values || []) {
      if (fieldValue.field?.[0] !== fieldName) continue

      const textValue = fieldValue.value?.[0]?.stringValue
      if (textValue?.[0] === oldValue) textValue[0] = newValue
    }

    await file.writeXml(metadata)
  }
}

module.exports = definePlugin({
  name: 'custom-metadata-values',
  stage: 'metadata',
  formats: ['metadata', 'sfdx'],

  enabled: ({ config, files }) => {
    const settings = config.pluginRecipes?.customMetadataValues
    return !!settings && (!files || files.match(settings.files || 'customMetadata/*.md').length > 0)
  },

  async onDeploy ({ files, target, config, log }) {
    const values = readValues(config, target.environment)
    await changeCustomMetadataValues(files, values.filePatterns, values.field, values.gitValue, values.environmentValue)
    log.info(\`Using \${target.environment} Custom Metadata value\`)
  },

  async onRetrieve ({ files, target, config }) {
    const values = readValues(config, target.environment)
    await changeCustomMetadataValues(files, values.filePatterns, values.field, values.environmentValue, values.gitValue)
  }
})
`

export const buildPluginRecipe = (id: PluginRecipeId, environments: string[]): GeneratedPluginRecipe => {
  const recipe = pluginRecipes.find(item => item.id === id)
  if (!recipe) throw new Error(`Unknown plugin recipe '${id}'`)
  const normalizedEnvironments = [...new Set(environments.map(value => value.trim()).filter(Boolean))].sort()
  if (!normalizedEnvironments.length) throw new Error('At least one Salesforce environment is required')

  let source: string
  let configuration: Record<string, unknown>
  switch (id) {
    case 'environment-endpoints':
      source = endpointSource
      configuration = {
        gitUrl: 'https://service.example.invalid',
        urlsByEnvironment: valuesByEnvironment(normalizedEnvironments, 'set endpoint')
      }
      break
    case 'workflow-emails':
      source = workflowSource
      configuration = {
        files: ['workflows/*.workflow'],
        gitEmail: 'notifications@example.invalid',
        emailsByEnvironment: valuesByEnvironment(normalizedEnvironments, 'set Workflow email')
      }
      break
    case 'custom-metadata-values':
      source = customMetadataSource
      configuration = {
        files: ['customMetadata/*.md'],
        field: 'TODO: set the text field API name',
        gitValue: 'VALUE_STORED_IN_GIT',
        valuesByEnvironment: valuesByEnvironment(normalizedEnvironments, 'set Custom Metadata value')
      }
      break
  }

  return {
    recipe,
    relativePath: `sfdy-plugins/${recipe.fileName}`,
    source,
    configuration
  }
}
