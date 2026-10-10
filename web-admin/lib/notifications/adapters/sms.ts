/**
 * SMS delivery adapter — Twilio Programmable Messaging.
 * Reads TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM from env.
 * Called by the outbox processor for channel_code = 'SMS'.
 *
 * Kill-switch gate: when NTF_DISPATCH_VIA_HQ=true the send is routed through
 * the HQ Dispatch Proxy (POST platform-api /api/hq/v1/notifications/dispatch).
 */

import twilio from 'twilio'
import { logger } from '@lib/utils/logger'
import { getNtfHqDispatchUrl, getTwilioSmsFrom, isNtfDispatchViaHq } from '@lib/notifications/config'
import { collectMissingEnv, logMissingNotificationEnv } from '@lib/notifications/log-missing-env'
import { resolveCustomerDispatchConsent } from '@lib/notifications/customer-dispatch-consent'
import { checkSuppression } from '@lib/notifications/suppression-list'
import { notificationSettingsService } from '@lib/notifications/settings-service'

/**
 *
 */
export interface OutboxSmsRow {
  id: string
  tenant_org_id: string
  recipient_address: string | null   // E.164 phone number, e.g. +96891234567
  rendered_body: string
  event_code: string | null
  retry_count: number
  /** Enables a fresh tenant-customer SMS consent recheck before every send. */
  source_entity_type?: string | null
  source_entity_id?: string | null
}

/**
 *
 */
export interface SmsDeliveryResult {
  success: boolean
  errorMessage?: string
  permanent?: boolean
  /** Policy blocks must not retry and must not count as a provider failure. */
  skipped?: boolean
  /** Provider (Twilio SID, direct or via the HQ proxy) message id, persisted for reconciliation. */
  providerMessageId?: string
}

async function deliverViaHqProxy(row: OutboxSmsRow): Promise<SmsDeliveryResult> {
  const hqUrl = await getNtfHqDispatchUrl()
  const hqKey = process.env.NTF_HQ_SERVICE_ROLE_KEY ?? ''

  if (!hqKey) {
    logger.error('sms-adapter: NTF_HQ_SERVICE_ROLE_KEY not set — cannot route via HQ proxy', undefined, {
      outboxId: row.id, feature: 'notifications',
    })
    return { success: false, errorMessage: 'NTF_HQ_SERVICE_ROLE_KEY not configured', permanent: true }
  }

  if (!row.recipient_address) {
    return { success: false, errorMessage: 'No recipient phone number', permanent: true }
  }

  const body = JSON.stringify({
    idempotencyKey: row.id,
    tenantOrgId:    row.tenant_org_id,
    channel:        'SMS',
    recipient:      row.recipient_address,
    payload:        { body: row.rendered_body },
    requestId:      row.id,
  })

  try {
    const res = await fetch(hqUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqKey}` },
      body,
      signal: AbortSignal.timeout(25_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const permanent = res.status >= 400 && res.status < 500 && res.status !== 429
      logger.warn('sms-adapter: HQ proxy returned non-OK', { outboxId: row.id, status: res.status, feature: 'notifications' })
      return { success: false, errorMessage: `HQ proxy HTTP ${res.status}: ${text}`, permanent }
    }

    const data = await res.json().catch(() => ({})) as { status?: string; providerMessageId?: string }
    if (data.status === 'PERMANENT_FAILURE') return { success: false, errorMessage: 'HQ: PERMANENT_FAILURE', permanent: true }
    if (data.status === 'FAILED') return { success: false, errorMessage: 'HQ: FAILED (temporary)', permanent: false }
    return { success: true, providerMessageId: data.providerMessageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('sms-adapter: HQ proxy fetch threw', err instanceof Error ? err : new Error(msg), {
      outboxId: row.id, feature: 'notifications',
    })
    return { success: false, errorMessage: msg, permanent: false }
  }
}

/**
 *
 * @param row
 */
export async function deliverSmsOutbox(row: OutboxSmsRow): Promise<SmsDeliveryResult> {
  if (!row.recipient_address) {
    return { success: false, errorMessage: 'No recipient phone number', permanent: true }
  }

  // Recheck tenant-customer SMS consent fresh at dispatch so a queued notification
  // respects an opt-out recorded after it was enqueued (plan invariant 4.1.12). Rows
  // with no resolvable customer (e.g. staff notifications) are unaffected.
  const consent = await resolveCustomerDispatchConsent(
    row.tenant_org_id, 'sms', row.source_entity_type, row.source_entity_id,
  )
  if (consent.applicable && !consent.allowed) {
    logger.info('sms-adapter: dispatch consent check blocked send', {
      outboxId: row.id, tenantOrgId: row.tenant_org_id, reason: consent.reason, feature: 'notifications',
    })
    return consent.retryable
      ? { success: false, errorMessage: consent.reason, permanent: false }
      : { success: false, skipped: true, errorMessage: consent.reason }
  }

  // Provider/carrier-reported suppression (e.g. STOP opt-out) blocks this specific
  // number regardless of the customer's own preference toggle (migration 0603).
  const suppression = await checkSuppression(row.tenant_org_id, 'SMS', row.recipient_address)
  if (suppression.suppressed) {
    const reason = `SUPPRESSED_${suppression.reasonCode}`
    logger.info('sms-adapter: recipient number is on the suppression list — skipping', {
      outboxId: row.id, tenantOrgId: row.tenant_org_id, reasonCode: suppression.reasonCode, feature: 'notifications',
    })
    return { success: false, skipped: true, errorMessage: reason }
  }

  // Global master switch AND a per-tenant/channel opt-in — see the identical
  // comment in adapters/whatsapp.ts (same 2026-10-10 A1 scoping fix).
  if (await isNtfDispatchViaHq() && await notificationSettingsService.isHqDispatchEnabledForChannel(row.tenant_org_id, 'SMS')) {
    return deliverViaHqProxy(row)
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = await getTwilioSmsFrom()

  if (!accountSid || !authToken || !from) {
    const missing = [
      ...collectMissingEnv(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN']),
      ...(!from ? ['TWILIO_SMS_FROM|sys_ntf_runtime_cf.twilio_sms_from'] : []),
    ]
    logMissingNotificationEnv({
      adapter: 'sms-adapter',
      missing,
      outboxId: row.id,
      extra: { tenantOrgId: row.tenant_org_id },
    })
    return { success: false, errorMessage: 'Twilio SMS credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_SMS_FROM)', permanent: false }
  }

  if (!row.recipient_address) {
    logger.warn('sms-adapter: no recipient phone number', {
      outboxId: row.id, tenantOrgId: row.tenant_org_id, feature: 'notifications',
    })
    return { success: false, errorMessage: 'No recipient phone number', permanent: true }
  }

  try {
    const client = twilio(accountSid, authToken)
    const message = await client.messages.create({
      from,
      to:   row.recipient_address,
      body: row.rendered_body,
    })

    logger.info('sms-adapter: sent', {
      outboxId: row.id, messageSid: message.sid,
      to: row.recipient_address.slice(0, -4) + '****',
      feature: 'notifications',
    })

    return { success: true, providerMessageId: message.sid }
  } catch (err) {
    const error = err as { code?: number; message?: string; status?: number }
    const msg   = error.message ?? 'Unknown Twilio error'
    const code  = error.code

    // Twilio permanent error codes: 21211 (invalid number), 21614 (not SMS-capable)
    const permanent = code === 21211 || code === 21614

    logger.error('sms-adapter: delivery failed', new Error(msg), {
      outboxId: row.id, twilioCode: code, permanent, feature: 'notifications',
    })

    return { success: false, errorMessage: msg, permanent }
  }
}
