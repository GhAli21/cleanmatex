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
}

/**
 *
 */
export interface SmsDeliveryResult {
  success: boolean
  errorMessage?: string
  permanent?: boolean
}

async function deliverViaHqProxy(row: OutboxSmsRow): Promise<SmsDeliveryResult> {
  const hqUrl = process.env.NTF_HQ_DISPATCH_URL ?? 'http://localhost:3002/api/hq/v1/notifications/dispatch'
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

    const data = await res.json().catch(() => ({})) as { status?: string }
    if (data.status === 'PERMANENT_FAILURE') return { success: false, errorMessage: 'HQ: PERMANENT_FAILURE', permanent: true }
    if (data.status === 'FAILED') return { success: false, errorMessage: 'HQ: FAILED (temporary)', permanent: false }
    return { success: true }
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

  if (process.env.NTF_DISPATCH_VIA_HQ === 'true') {
    return deliverViaHqProxy(row)
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_SMS_FROM

  if (!accountSid || !authToken || !from) {
    return { success: false, errorMessage: 'Twilio SMS credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_SMS_FROM)', permanent: false }
  }

  if (!row.recipient_address) {
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

    return { success: true }
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
