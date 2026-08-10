import { ConfigCredential } from '../fast-sfdc'

export const credentialEnvironment = (credential: ConfigCredential): string =>
  credential.environment || credential.alias || 'unknown environment'

export const credentialLabel = (credential: ConfigCredential): string =>
  `${credentialEnvironment(credential)} - ${credential.username || 'unknown user'}${credential.readOnly ? ' [read-only]' : ''}`

export const environmentIsAvailable = (
  credentials: ConfigCredential[],
  environment: string,
  currentCredential?: ConfigCredential
): boolean => {
  const normalized = environment.trim().toLowerCase()
  return !credentials.some(credential =>
    credential !== currentCredential &&
    credentialEnvironment(credential).toLowerCase() === normalized
  )
}
