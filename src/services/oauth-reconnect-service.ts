import * as vscode from 'vscode'
import type { CredentialManager, CredentialProfile } from 'sfdy/credentials'
import { DEFAULT_CLIENT_ID } from 'sfdy/constants'
import { credentialLabel } from './credential-label-service'
import auth = require('sfdy/auth')

const pendingReconnects = new Set<string>()
let signingIn = false

export const authenticateOAuth = async (host: string, clientId: string = DEFAULT_CLIENT_ID, clientSecret?: string) => {
  if (signingIn) throw new Error('A Salesforce sign-in is already in progress. Complete it in your browser and try again.')
  signingIn = true
  try {
    const { oauth2, userInfo } = await auth(host, clientId, clientSecret, 3000)
    if (!oauth2.refresh_token) {
      throw new Error('Salesforce did not return a refresh token. Check the Connected App OAuth scopes and refresh-token policy.')
    }
    if (!oauth2.access_token || !oauth2.instance_url || !userInfo.username) {
      throw new Error('Salesforce did not return a complete sign-in response.')
    }
    return { oauth2, userInfo, refreshToken: oauth2.refresh_token }
  } finally {
    signingIn = false
  }
}

const isExpiredRefreshToken = (error: unknown): boolean => {
  if (!(error instanceof Error) || error.name !== 'SalesforceOAuthError') return false
  const detail = (error as Error & { detail?: { error?: unknown; 'error_description'?: unknown } }).detail
  return detail?.error === 'invalid_grant' &&
    typeof detail.error_description === 'string' &&
    /^expired access\/refresh token$/i.test(detail.error_description.trim())
}

const offerReconnect = async (manager: CredentialManager, selector: string, expiredProfile: CredentialProfile): Promise<void> => {
  const key = JSON.stringify([manager.vaultPath, selector])
  if (pendingReconnects.has(key)) return
  pendingReconnects.add(key)
  const label = credentialLabel(expiredProfile)

  try {
    const choice = await vscode.window.showWarningMessage(`The Salesforce sign-in for ${label} has expired.`, 'Reconnect', 'Later')
    if (choice !== 'Reconnect') return

    const current = await manager.get(selector)
    if (current.refreshToken !== expiredProfile.refreshToken) return
    const url = current.serverUrl || current.instanceUrl
    if (!url) throw new Error('The saved credential has no Salesforce login domain.')
    const savedHost = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).host
    const host = !current.serverUrl && /^cs\d+\.salesforce\.com$/i.test(savedHost) ? 'test.salesforce.com' : savedHost
    const { oauth2, userInfo } = await authenticateOAuth(host, current.clientId, current.clientSecret)
    if (userInfo.username.toLowerCase() !== current.username.toLowerCase()) {
      throw new Error(`Sign in as ${current.username} to reconnect this credential.`)
    }

    await manager.refreshOAuthToken(selector, async profile => {
      if (profile.refreshToken !== current.refreshToken || profile.username !== current.username ||
          profile.clientId !== current.clientId || profile.clientSecret !== current.clientSecret ||
          profile.serverUrl !== current.serverUrl) {
        throw new Error('The saved credential changed during sign-in. Retry the Salesforce command.')
      }
      return oauth2
    })
    vscode.window.showInformationMessage(`Reconnected to Salesforce as ${current.username}. Retry the command to continue.`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    vscode.window.showErrorMessage(`Unable to reconnect ${label}. ${message}`)
  } finally {
    pendingReconnects.delete(key)
  }
}

export const withOAuthReconnect = (manager: CredentialManager): CredentialManager => ({
  ...manager,
  async refreshOAuthToken (selector, exchange) {
    let profileUsed: CredentialProfile | undefined
    try {
      return await manager.refreshOAuthToken(selector, profile => {
        profileUsed = profile
        return exchange(profile)
      })
    } catch (error) {
      if (profileUsed && isExpiredRefreshToken(error)) offerReconnect(manager, selector, profileUsed)
      throw error
    }
  }
})
