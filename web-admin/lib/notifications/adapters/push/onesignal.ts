/**
 * OneSignal REST API sub-adapter.
 * Sends push notifications via OneSignal's Create Notification endpoint.
 * Free tier: up to 10,000 subscribers, unlimited sends.
 *
 * ENV vars required:
 *   ONESIGNAL_APP_ID          — OneSignal App ID (UUID)
 *   ONESIGNAL_REST_API_KEY    — OneSignal REST API key (from Dashboard > Keys & IDs)
 *
 * subscription_data shape (from org_ntf_push_subs_dtl):
 *   { "player_id": "..." }   — OneSignal player/subscription ID
 */

import { logger } from '@lib/utils/logger'

/**
 *
 */
export interface OneSignalSubscriptionData {
  player_id: string
}

/**
 *
 */
export interface OneSignalSendResult {
  success: boolean
  subscriptionId: string
  errorMessage?: string
  permanent?: boolean
}

/**
 *
 * @param subscriptionId
 * @param subscriptionData
 * @param payload
 */
export async function sendOneSignalPush(
  subscriptionId: string,
  subscriptionData: OneSignalSubscriptionData,
  payload: string,   // JSON string: { title, body, data, ... }
): Promise<OneSignalSendResult> {
  const appId  = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY

  if (!appId || !apiKey) {
    return {
      success: false,
      subscriptionId,
      errorMessage: 'OneSignal not configured (ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY)',
      permanent: false,
    }
  }

  try {
    const parsed = JSON.parse(payload) as { title?: string; body?: string; data?: Record<string, string> }

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method:  'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        app_id:                         appId,
        include_player_ids:             [subscriptionData.player_id],
        headings:                       { en: parsed.title ?? '' },
        contents:                       { en: parsed.body  ?? '' },
        data:                           parsed.data ?? {},
        priority:                       10,
        ttl:                            86400,
      }),
    })

    const data = await res.json() as {
      id?:      string
      errors?:  string[] | { invalid_player_ids?: string[]; invalid_external_user_ids?: string[] }
      recipients?: number
    }

    if (res.ok && (data.recipients ?? 0) > 0) {
      logger.info('push-adapter(onesignal): sent', { subscriptionId, notifId: data.id, feature: 'notifications' })
      return { success: true, subscriptionId }
    }

    // Check for invalid player IDs (subscription expired/invalid)
    const errors = data.errors
    const hasInvalidPlayer =
      Array.isArray(errors)
        ? errors.some((e: string) => e.toLowerCase().includes('invalid'))
        : (errors?.invalid_player_ids?.includes(subscriptionData.player_id) ?? false)

    const msg = Array.isArray(errors) ? errors.join(', ') : JSON.stringify(errors ?? `HTTP ${res.status}`)

    if (hasInvalidPlayer) {
      logger.warn('push-adapter(onesignal): invalid player_id — deactivating', { subscriptionId, feature: 'notifications' })
      return { success: false, subscriptionId, errorMessage: msg, permanent: true }
    }

    logger.error('push-adapter(onesignal): failed', new Error(msg), { subscriptionId, feature: 'notifications' })
    return { success: false, subscriptionId, errorMessage: msg, permanent: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown OneSignal error'
    logger.error('push-adapter(onesignal): exception', new Error(msg), { subscriptionId, feature: 'notifications' })
    return { success: false, subscriptionId, errorMessage: msg, permanent: false }
  }
}
