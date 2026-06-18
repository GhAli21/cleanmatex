/**
 * WhatsApp delivery adapter — factory supporting two providers:
 *   TWILIO_WHATSAPP  — Twilio as BSP (uses twilio npm package)
 *   META_WHATSAPP    — Meta Cloud API (direct HTTP)
 *
 * Provider selected via org_ntf_channel_provider_cf (active provider for WHATSAPP channel).
 * Called by the outbox processor for channel_code = 'WHATSAPP'.
 *
 * ENV vars:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM   — for TWILIO_WHATSAPP
 *   META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID      — for META_WHATSAPP
 */

import twilio from 'twilio'
import { logger } from '@lib/utils/logger'
import { notificationSettingsService } from '@lib/notifications/settings-service'

/**
 *
 */
export interface OutboxWhatsAppRow {
  id: string
  tenant_org_id: string
  recipient_address: string | null   // E.164 phone number
  rendered_body: string
  rendered_subject: string | null    // used as template name hint for META API
  event_code: string | null
  retry_count: number
}

/**
 *
 */
export interface WhatsAppDeliveryResult {
  success: boolean
  errorMessage?: string
  permanent?: boolean
}

// ---------------------------------------------------------------------------
// Twilio BSP
// ---------------------------------------------------------------------------

async function sendViaTwilio(row: OutboxWhatsAppRow): Promise<WhatsAppDeliveryResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_WHATSAPP_FROM   // e.g. whatsapp:+14155238886

  if (!accountSid || !authToken || !from) {
    return { success: false, errorMessage: 'Twilio WhatsApp credentials not configured', permanent: false }
  }
  if (!row.recipient_address) {
    return { success: false, errorMessage: 'No recipient phone number', permanent: true }
  }

  try {
    const client = twilio(accountSid, authToken)
    const message = await client.messages.create({
      from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      to:   `whatsapp:${row.recipient_address}`,
      body: row.rendered_body,
    })

    logger.info('whatsapp-adapter(twilio): sent', {
      outboxId: row.id, messageSid: message.sid, feature: 'notifications',
    })
    return { success: true }
  } catch (err) {
    const error = err as { code?: number; message?: string }
    const msg   = error.message ?? 'Unknown Twilio error'
    const permanent = error.code === 21211 || error.code === 21614
    logger.error('whatsapp-adapter(twilio): failed', new Error(msg), {
      outboxId: row.id, code: error.code, permanent, feature: 'notifications',
    })
    return { success: false, errorMessage: msg, permanent }
  }
}

// ---------------------------------------------------------------------------
// Meta Cloud API
// NOTE: In production, replace type:'text' with type:'template' using a
//       pre-approved META template name + components. Free-form text is only
//       allowed within the 24h customer-initiated window.
// ---------------------------------------------------------------------------

async function sendViaMeta(row: OutboxWhatsAppRow): Promise<WhatsAppDeliveryResult> {
  const accessToken   = process.env.META_WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID

  if (!accessToken || !phoneNumberId) {
    return { success: false, errorMessage: 'Meta WhatsApp credentials not configured (META_WHATSAPP_ACCESS_TOKEN / META_WHATSAPP_PHONE_NUMBER_ID)', permanent: false }
  }
  if (!row.recipient_address) {
    return { success: false, errorMessage: 'No recipient phone number', permanent: true }
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to:                row.recipient_address,
          type:              'text',
          text:              { body: row.rendered_body },
        }),
      }
    )

    if (res.ok) {
      const data = await res.json() as { messages?: { id: string }[] }
      logger.info('whatsapp-adapter(meta): sent', {
        outboxId: row.id, messageId: data.messages?.[0]?.id, feature: 'notifications',
      })
      return { success: true }
    }

    const errBody = await res.json() as { error?: { message?: string; code?: number } }
    const msg     = errBody.error?.message ?? `Meta API ${res.status}`
    // 130429 = rate limit (temporary), 131047/131051 = permanent errors
    const permanent = res.status === 400 || (errBody.error?.code ?? 0) > 131000
    logger.error('whatsapp-adapter(meta): failed', new Error(msg), {
      outboxId: row.id, httpStatus: res.status, permanent, feature: 'notifications',
    })
    return { success: false, errorMessage: msg, permanent }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    return { success: false, errorMessage: msg, permanent: false }
  }
}

// ---------------------------------------------------------------------------
// Factory — reads active provider from settings service
// ---------------------------------------------------------------------------

async function deliverViaHqProxy(row: OutboxWhatsAppRow): Promise<WhatsAppDeliveryResult> {
  const hqUrl = process.env.NTF_HQ_DISPATCH_URL ?? 'http://localhost:3002/api/hq/v1/notifications/dispatch'
  const hqKey = process.env.NTF_HQ_SERVICE_ROLE_KEY ?? ''

  if (!hqKey) {
    logger.error('whatsapp-adapter: NTF_HQ_SERVICE_ROLE_KEY not set', undefined, {
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
    channel:        'WHATSAPP',
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
      logger.warn('whatsapp-adapter: HQ proxy non-OK', { outboxId: row.id, status: res.status, feature: 'notifications' })
      return { success: false, errorMessage: `HQ proxy HTTP ${res.status}: ${text}`, permanent }
    }

    const data = await res.json().catch(() => ({})) as { status?: string }
    if (data.status === 'PERMANENT_FAILURE') return { success: false, errorMessage: 'HQ: PERMANENT_FAILURE', permanent: true }
    if (data.status === 'FAILED') return { success: false, errorMessage: 'HQ: FAILED (temporary)', permanent: false }
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('whatsapp-adapter: HQ proxy fetch threw', err instanceof Error ? err : new Error(msg), {
      outboxId: row.id, feature: 'notifications',
    })
    return { success: false, errorMessage: msg, permanent: false }
  }
}

/**
 *
 * @param row
 */
export async function deliverWhatsAppOutbox(row: OutboxWhatsAppRow): Promise<WhatsAppDeliveryResult> {
  if (process.env.NTF_DISPATCH_VIA_HQ === 'true') {
    return deliverViaHqProxy(row)
  }

  const provider = await notificationSettingsService.getActiveProvider(row.tenant_org_id, 'WHATSAPP')

  if (!provider) {
    return { success: false, errorMessage: 'No active WhatsApp provider configured in org_ntf_channel_provider_cf', permanent: false }
  }

  switch (provider.providerCode) {
    case 'TWILIO_WHATSAPP':
      return sendViaTwilio(row)
    case 'META_WHATSAPP':
      return sendViaMeta(row)
    default:
      return { success: false, errorMessage: `Unknown WhatsApp provider: ${provider.providerCode}`, permanent: true }
  }
}
