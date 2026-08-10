import { ConfigCredential } from '../fast-sfdc'

export type OrganizationKind = 'sandbox' | 'development' | 'production' | 'unknown'

export interface OrganizationInfo {
  IsSandbox?: boolean | string;
  OrganizationType?: string;
}

const isTrue = (value: boolean | string | undefined): boolean => value === true || value === 'true'
const isFalse = (value: boolean | string | undefined): boolean => value === false || value === 'false'

export const classifyOrganization = (organization?: OrganizationInfo): OrganizationKind => {
  if (!organization) return 'unknown'
  if (isTrue(organization.IsSandbox)) return 'sandbox'

  const organizationType = (organization.OrganizationType || '').trim().toLowerCase()
  if (organizationType.includes('developer') || organizationType.includes('scratch')) return 'development'
  if (isFalse(organization.IsSandbox) && organizationType) return 'production'
  return 'unknown'
}

export const credentialCacheKey = (credential: ConfigCredential): string =>
  credential.id || credential.instanceUrl || credential.username || credential.environment || credential.alias || 'active'
