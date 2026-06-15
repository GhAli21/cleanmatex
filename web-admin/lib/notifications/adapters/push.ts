/**
 * Push notification adapter factory.
 *
 * Reads the active push provider from NotificationSettingsService, fetches all
 * matching active subscriptions for the recipient user, and fans out to the
 * provider-specific sub-adapter (VAPID / FCM / OneSignal).
 *
 * On per-subscription permanent failure (410, UNREGISTERED, invalid player_id):
 *   - Increments failure_count in org_ntf_push_subs_dtl
 *   - Sets is_active=false when failure_count >= 3 OR provider signals permanent rejection
 *
 * Called by process-outbox for channel_code = 'PUSH'.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { notificationSettingsService } from '@lib/notifications/settings-service'
import { logger } from '@lib/utils/logger'
import { sendVapidPush,     type VapidSubscriptionData     } from './push/vapid'
import { sendFcmPush,       type FcmSubscriptionData       } from './push/fcm'
import { sendOneSignalPush, type OneSignalSubscriptionData } from './push/onesignal'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OutboxPushRow {
  id:               string
  tenant_org_id:    string
  recipient_user_id: string | null
  rendered_subject: string | null  // notification title
  rendered_body:    string         // notification body
  event_code:       string | null
  retry_count:      number
}

export interface PushDeliveryResult {
  success: boolean
  sentCount: number
  skippedCount: number
  errorMessage?: string
}

interface PushSubscriptionRow {
  id:                string
  provider_code:     string
  platform:          string
  subscription_data: Record<string, unknown>
  failure_count:     number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPayload(row: OutboxPushRow): string {
  return JSON.stringify({
    title: row.rendered_subject ?? 'CleanMateX',
    body:  row.rendered_body,
    data:  {
      outbox_id:  row.id,
      event_code: row.event_code ?? '',
    },
  })
}

async function recordFailure(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  subscription: PushSubscriptionRow,
  permanent: boolean,
): Promise<void> {
  const newCount = (subscription.failure_count ?? 0) + 1
  const deactivate = permanent || newCount >= 3

  await supabase
    .from('org_ntf_push_subs_dtl')
    .update({
      failure_count: newCount,
      ...(deactivate ? { is_active: false } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id)
}

async function recordSuccess(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  subscriptionId: string,
): Promise<void> {
  await supabase
    .from('org_ntf_push_subs_dtl')
    .update({ last_verified_at: new Date().toISOString(), failure_count: 0, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)
}

// ---------------------------------------------------------------------------
// Main adapter
// ---------------------------------------------------------------------------

export async function deliverPushOutbox(row: OutboxPushRow): Promise<PushDeliveryResult> {
  if (!row.recipient_user_id) {
    return { success: false, sentCount: 0, skippedCount: 0, errorMessage: 'No recipient_user_id for PUSH channel' }
  }

  const provider = await notificationSettingsService.getActiveProvider(row.tenant_org_id, 'PUSH')
  if (!provider) {
    return { success: false, sentCount: 0, skippedCount: 0, errorMessage: 'No active PUSH provider configured' }
  }

  const supabase = createAdminSupabaseClient()

  // Fetch all active subscriptions for this user + provider
  const { data: subscriptions, error: fetchError } = await supabase
    .from('org_ntf_push_subs_dtl')
    .select('id, provider_code, platform, subscription_data, failure_count')
    .eq('tenant_org_id',    row.tenant_org_id)
    .eq('user_id',          row.recipient_user_id)
    .eq('provider_code',    provider.providerCode)
    .eq('is_active',        true)

  if (fetchError) {
    return { success: false, sentCount: 0, skippedCount: 0, errorMessage: `Failed to load subscriptions: ${fetchError.message}` }
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { success: true, sentCount: 0, skippedCount: 0 }
  }

  const payload = buildPayload(row)
  let sentCount    = 0
  let skippedCount = 0

  for (const sub of subscriptions as PushSubscriptionRow[]) {
    const data = sub.subscription_data

    let result: { success: boolean; subscriptionId: string; errorMessage?: string; permanent?: boolean }

    switch (sub.provider_code) {
      case 'VAPID':
        result = await sendVapidPush(sub.id, data as VapidSubscriptionData, payload)
        break
      case 'FCM':
        result = await sendFcmPush(sub.id, data as FcmSubscriptionData, payload)
        break
      case 'ONESIGNAL':
        result = await sendOneSignalPush(sub.id, data as OneSignalSubscriptionData, payload)
        break
      default:
        logger.warn('push-adapter: unknown provider_code', { providerCode: sub.provider_code, subscriptionId: sub.id, feature: 'notifications' })
        skippedCount++
        continue
    }

    if (result.success) {
      sentCount++
      await recordSuccess(supabase, sub.id)
    } else {
      skippedCount++
      await recordFailure(supabase, sub, result.permanent ?? false)
      logger.warn('push-adapter: subscription failed', {
        subscriptionId: sub.id, providerCode: sub.provider_code,
        permanent: result.permanent, errorMessage: result.errorMessage,
        outboxId: row.id, feature: 'notifications',
      })
    }
  }

  const success = sentCount > 0 || (subscriptions.length === 0)
  return { success, sentCount, skippedCount }
}
