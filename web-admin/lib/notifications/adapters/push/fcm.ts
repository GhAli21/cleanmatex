/**
 * FCM (Firebase Cloud Messaging) v1 HTTP sub-adapter.
 * Uses the FCM v1 REST API with a service account JWT — no Firebase SDK dependency.
 *
 * ENV vars required:
 *   FCM_SERVICE_ACCOUNT_JSON — full service account JSON (base64-encoded or raw JSON string)
 *   FCM_PROJECT_ID           — Firebase project ID (also in service account JSON)
 *
 * subscription_data shape (from org_notif_push_subs_dtl):
 *   { "token": "device-registration-token" }
 *
 * Authentication: OAuth2 access token obtained via JWT grant
 * (https://firebase.google.com/docs/cloud-messaging/auth-server#authorize-http-requests)
 */

import { logger } from '@lib/utils/logger'

export interface FcmSubscriptionData {
  token: string
}

export interface FcmSendResult {
  success: boolean
  subscriptionId: string
  errorMessage?: string
  permanent?: boolean
}

interface FcmServiceAccount {
  type:                        string
  project_id:                  string
  private_key_id:              string
  private_key:                 string
  client_email:                string
  token_uri:                   string
}

// Simple in-process cache for FCM access token (valid for 1 hour)
let cachedToken:    string | null = null
let tokenExpiresAt: number        = 0

async function getFcmAccessToken(sa: FcmServiceAccount): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken

  const now = Math.floor(Date.now() / 1000)
  const header  = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   sa.token_uri,
    iat:   now,
    exp:   now + 3600,
  }

  function b64url(obj: unknown) {
    return Buffer.from(JSON.stringify(obj)).toString('base64url')
  }

  const signingInput = `${b64url(header)}.${b64url(payload)}`

  // Sign with RSA-SHA256 using the service account private key
  const { createSign } = await import('crypto')
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  const signature = signer.sign(sa.private_key, 'base64url')

  const jwt = `${signingInput}.${signature}`

  const tokenRes = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }).toString(),
  })

  const tokenData = await tokenRes.json() as { access_token?: string; expires_in?: number }
  if (!tokenData.access_token) throw new Error('Failed to obtain FCM access token')

  cachedToken    = tokenData.access_token
  tokenExpiresAt = Date.now() + (tokenData.expires_in ?? 3600) * 1000
  return cachedToken
}

function loadServiceAccount(): FcmServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON
  if (!raw) return null

  try {
    // Support both raw JSON string and base64-encoded JSON
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8')
    return JSON.parse(json) as FcmServiceAccount
  } catch {
    return null
  }
}

export async function sendFcmPush(
  subscriptionId: string,
  subscriptionData: FcmSubscriptionData,
  payload: string,   // JSON string: { title, body, data, ... }
): Promise<FcmSendResult> {
  const sa = loadServiceAccount()
  const projectId = process.env.FCM_PROJECT_ID

  if (!sa || !projectId) {
    return {
      success: false,
      subscriptionId,
      errorMessage: 'FCM not configured (FCM_SERVICE_ACCOUNT_JSON / FCM_PROJECT_ID)',
      permanent: false,
    }
  }

  try {
    const parsed = JSON.parse(payload) as { title?: string; body?: string; data?: Record<string, string> }
    const accessToken = await getFcmAccessToken(sa)

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          message: {
            token:        subscriptionData.token,
            notification: { title: parsed.title ?? '', body: parsed.body ?? '' },
            data:         parsed.data ?? {},
            android:      { priority: 'high' },
            apns:         { payload: { aps: { sound: 'default' } } },
          },
        }),
      }
    )

    if (res.ok) {
      const data = await res.json() as { name?: string }
      logger.info('push-adapter(fcm): sent', { subscriptionId, messageId: data.name, feature: 'notifications' })
      return { success: true, subscriptionId }
    }

    const errBody = await res.json() as { error?: { status?: string; message?: string } }
    const status  = errBody.error?.status ?? ''
    const msg     = errBody.error?.message ?? `FCM HTTP ${res.status}`

    // UNREGISTERED or INVALID_ARGUMENT with token error = deactivate permanently
    const permanent = status === 'NOT_FOUND' || status === 'UNREGISTERED' ||
      (status === 'INVALID_ARGUMENT' && msg.toLowerCase().includes('token'))

    logger.error('push-adapter(fcm): failed', new Error(msg), {
      subscriptionId, fcmStatus: status, permanent, feature: 'notifications',
    })
    return { success: false, subscriptionId, errorMessage: msg, permanent }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown FCM error'
    logger.error('push-adapter(fcm): exception', new Error(msg), { subscriptionId, feature: 'notifications' })
    return { success: false, subscriptionId, errorMessage: msg, permanent: false }
  }
}
