import { ConfigCredential } from '../fast-sfdc'

export const credentialAlias = (credential: ConfigCredential): string =>
  credential.alias || credential.environment || credential.username || 'unknown target'

export const credentialEnvironment = (credential: ConfigCredential): string =>
  credential.environment || credential.alias || 'unknown environment'

export const credentialLabel = (credential: ConfigCredential): string =>
  `${credentialAlias(credential)} - ${credential.username || 'unknown user'}${credential.readOnly ? ' [read-only]' : ''}`

export const aliasIsAvailable = (
  credentials: ConfigCredential[],
  alias: string,
  currentCredential?: ConfigCredential
): boolean => {
  const normalized = alias.trim().toLowerCase()
  return !credentials.some(credential =>
    credential !== currentCredential &&
    credentialAlias(credential).toLowerCase() === normalized
  )
}

export const reserveUniqueCredentialAlias = (preferredAlias: string, usedAliases: Set<string>): string => {
  const baseAlias = preferredAlias.trim() || 'credential'
  let alias = baseAlias
  let suffix = 2
  while (usedAliases.has(alias.toLowerCase())) alias = `${baseAlias}-${suffix++}`
  usedAliases.add(alias.toLowerCase())
  return alias
}
