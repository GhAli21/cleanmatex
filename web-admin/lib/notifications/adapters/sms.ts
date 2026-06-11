/**
 * SMS delivery adapter — Twilio Programmable Messaging.
 * Reads TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM from env.
 * Called by the outbox processor for channel_code = 'SMS'.
 */

import twilio from 'twilio'
import { logger } from '@lib/utils/logger'

export interface OutboxSmsRow {
  id: string
  tenant_org_id: string
  recipient_address: string | null   // E.164 phone number, e.g. +96891234567
  rendered_body: string
  event_code: string | null
  retry_count: number
}

export interface SmsDeliveryResult {
  success: boolean
  errorMessage?: string
  permanent?: boolean
}

export async function deliverSmsOutbox(row: OutboxSmsRow): Promise<SmsDeliveryResult> {
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
