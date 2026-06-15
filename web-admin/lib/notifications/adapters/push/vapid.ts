/**
 * VAPID Web Push sub-adapter.
 * Uses the `web-push` npm package to send encrypted browser push notifications
 * via the W3C Web Push standard. No vendor account required — only VAPID key pair.
 *
 * ENV vars required:
 *   VAPID_PUBLIC_KEY   — base64url-encoded P-256 public key
 *   VAPID_PRIVATE_KEY  — base64url-encoded P-256 private key
 *   VAPID_SUBJECT      — mailto: or https: contact URI (e.g. "mailto:admin@example.com")
 *
 * subscription_data shape (from org_ntf_push_subs_dtl):
 *   { "endpoint": "https://fcm.googleapis.com/...", "keys": { "p256dh": "...", "auth": "..." } }
 */

import webpush from 'web-push'
import { logger } from '@lib/utils/logger'

export interface VapidSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth:   string
  }
}

export interface VapidSendResult {
  success: boolean
  subscriptionId: string
  errorMessage?: string
  permanent?: boolean   // true = subscription is invalid, deactivate it
}

let vapidConfigured = false

function ensureVapidConfigured() {
  if (vapidConfigured) return true

  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT

  if (!publicKey || !privateKey || !subject) return false

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return true
}

export async function sendVapidPush(
  subscriptionId: string,
  subscriptionData: VapidSubscriptionData,
  payload: string,   // JSON string: { title, body, data, ... }
): Promise<VapidSendResult> {
  if (!ensureVapidConfigured()) {
    return {
      success: false,
      subscriptionId,
      errorMessage: 'VAPID not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT)',
      permanent: false,
    }
  }

  try {
    await webpush.sendNotification(subscriptionData, payload, { TTL: 86400 })

    logger.info('push-adapter(vapid): sent', { subscriptionId, feature: 'notifications' })
    return { success: true, subscriptionId }
  } catch (err) {
    const error = err as { statusCode?: number; body?: string; message?: string }
    const statusCode = error.statusCode ?? 0
    const msg        = error.message ?? 'Unknown web-push error'

    // 410 Gone / 404 Not Found = subscription expired or unregistered — deactivate permanently
    const permanent = statusCode === 410 || statusCode === 404

    logger.error('push-adapter(vapid): failed', new Error(msg), {
      subscriptionId, statusCode, permanent, feature: 'notifications',
    })

    return { success: false, subscriptionId, errorMessage: `${statusCode} ${msg}`, permanent }
  }
}
