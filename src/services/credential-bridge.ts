import { Config, ConfigCredential } from '../fast-sfdc'
import { CredentialProfile } from 'sfdy/credentials'

export interface CredentialSettings {
  deployOnSave?: boolean;
  readOnly?: boolean;
}

export interface StoredFastConfig {
  currentCredentialId?: string;
  credentialSettings?: Record<string, CredentialSettings>;
  credentials?: ConfigCredential[];
  currentCredential?: number;
}

export const toSharedCredential = (credential: ConfigCredential): CredentialProfile => ({
  id: credential.id,
  alias: credential.alias || credential.environment || credential.username,
  username: credential.username!,
  environment: credential.environment,
  instanceUrl: credential.instanceUrl,
  refreshToken: credential.type === 'oauth2' ? credential.password : undefined,
  password: credential.type === 'oauth2' ? undefined : credential.password,
  clientId: credential.clientId,
  clientSecret: credential.clientSecret,
  serverUrl: credential.url,
  authType: credential.type
})

export const fromSharedCredential = (
  profile: CredentialProfile & {id: string; alias: string},
  local: ConfigCredential = {}
): ConfigCredential => ({
  ...profile,
  ...local,
  id: profile.id,
  alias: profile.alias,
  username: profile.username,
  environment: local.environment || profile.environment,
  instanceUrl: profile.instanceUrl,
  password: profile.refreshToken || profile.password,
  type: local.type || profile.authType || (profile.refreshToken ? 'oauth2' : 'userpwd'),
  url: local.url || profile.serverUrl
})

export const toStoredFastConfig = (config: Config): StoredFastConfig => {
  const currentCredentialId = config.credentials[config.currentCredential]?.id
  const credentialSettings = Object.fromEntries(config.credentials
    .filter(credential => credential.id && (credential.deployOnSave !== undefined || credential.readOnly !== undefined))
    .map(credential => [credential.id!, {
      ...(credential.deployOnSave !== undefined ? { deployOnSave: credential.deployOnSave } : {}),
      ...(credential.readOnly !== undefined ? { readOnly: credential.readOnly } : {})
    }]))

  return {
    ...(currentCredentialId ? { currentCredentialId } : {}),
    ...(Object.keys(credentialSettings).length ? { credentialSettings } : {})
  }
}
