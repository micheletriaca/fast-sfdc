import { ConfigCredential } from '../fast-sfdc'
import * as constants from 'sfdy/constants'

export const buildRefreshTokenRequest = (credential: ConfigCredential) => ({
  grant_type: 'refresh_token',
  client_id: credential.clientId || constants.DEFAULT_CLIENT_ID,
  ...(credential.clientSecret ? { client_secret: credential.clientSecret } : {}),
  refresh_token: credential.password
})
