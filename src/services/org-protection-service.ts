import * as vscode from 'vscode'
import { Config } from '../fast-sfdc'
import configService from './config-service'
import sfdcConnector from '../sfdc-connector'
import { credentialEnvironment } from './credential-label-service'
import { classifyOrganization, credentialCacheKey, OrganizationKind } from './org-protection'
import logger from '../logger'

const CONTINUE = 'Continue'
const organizationKinds = new Map<string, Promise<OrganizationKind>>()

const activeCredential = (config: Config) => config.credentials[config.currentCredential]
const targetLabel = (config: Config): string => {
  const credential = activeCredential(config)
  return `${credentialEnvironment(credential)} (${credential.username || 'unknown user'})`
}

export const getOrganizationKind = async (config: Config): Promise<OrganizationKind> => {
  const credential = activeCredential(config)
  const key = credentialCacheKey(credential)
  const cached = organizationKinds.get(key)
  if (cached) return cached

  const pending = (async () => {
    try {
      const result = await sfdcConnector.query(
        'SELECT IsSandbox, OrganizationType FROM Organization LIMIT 1',
        true
      )
      return classifyOrganization(result.records?.[0])
    } catch (error) {
      logger.appendLine(`Unable to determine Salesforce organization type: ${error.message}`)
      return 'unknown'
    }
  })()
  organizationKinds.set(key, pending)
  return pending
}

export const clearOrganizationKindCache = (): void => organizationKinds.clear()

export const ensureOrgWritable = async (
  operation: string,
  options: {config?: Config; silent?: boolean} = {}
): Promise<boolean> => {
  const config = options.config || await configService.getConfig()
  const credential = activeCredential(config)
  if (!credential) return false
  if (!credential.readOnly) return true
  if (!options.silent) {
    await vscode.window.showErrorMessage(
      `${targetLabel(config)} is in read-only mode. Fast-Sfdc will not ${operation}.`
    )
  }
  return false
}

export const confirmProductionMutation = async (
  operation: string,
  config?: Config,
  detail?: string
): Promise<boolean> => {
  const resolvedConfig = config || await configService.getConfig()
  if (!activeCredential(resolvedConfig)) return false
  const organizationKind = await getOrganizationKind(resolvedConfig)
  if (organizationKind === 'sandbox' || organizationKind === 'development') return true

  const target = targetLabel(resolvedConfig)
  const message = organizationKind === 'production'
    ? `You are about to ${operation} on production org ${target}.`
    : `Fast-Sfdc could not determine whether ${target} is a production org. You are about to ${operation}.`
  const answer = await vscode.window.showWarningMessage(
    message,
    {
      modal: true,
      detail: detail || 'This operation can change Salesforce metadata or execute code in the target org.'
    },
    CONTINUE
  )
  return answer === CONTINUE
}

export const authorizeOrgMutation = async (
  operation: string,
  options: {config?: Config; silentReadOnly?: boolean} = {}
): Promise<boolean> => {
  const config = options.config || await configService.getConfig()
  if (!await ensureOrgWritable(operation, { config, silent: options.silentReadOnly })) return false
  return confirmProductionMutation(operation, config)
}
