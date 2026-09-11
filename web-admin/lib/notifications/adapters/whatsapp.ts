/**
 * WhatsApp delivery adapter — factory supporting two providers:
 *   TWILIO_WHATSAPP  — Twilio as BSP (uses twilio npm package)
 *   META_WHATSAPP    — Meta Cloud API (direct HTTP)
 *
 * Provider selected via org_ntf_channel_provider_cf (active provider for WHATSAPP channel).
 * Sandbox testing: set TWILIO_WHATSAPP_USE_SANDBOX_TEMPLATE=true and
 * TWILIO_WHATSAPP_SANDBOX_CONTENT_SID (order_created_simple Content SID).
 *
 * ENV vars:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM   — for TWILIO_WHATSAPP
 *   META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID      — for META_WHATSAPP
 */

import twilio from 'twilio'
import { logger } from '@lib/utils/logger'
import { notificationSettingsService } from '@lib/notifications/settings-service'
import {
  getNtfHqDispatchUrl,
  getTwilioWhatsappFrom,
  getTwilioWhatsappSandboxContentSid,
  getTwilioWhatsappSandboxToPhone,
  isNtfDispatchViaHq,
  isTwilioWhatsappSandboxTemplateEnabled,
} from '@lib/notifications/config'
import { buildTwilioContentVariables } from '@lib/notifications/adapters/whatsapp-content-variables'
import { collectMissingEnv, logMissingNotificationEnv } from '@lib/notifications/log-missing-env'
import { stripWhatsAppPrefix } from '@lib/notifications/whatsapp-phone'

async function resolveWhatsAppTo(row: OutboxWhatsAppRow): Promise<string | null> {
  const sandboxTo = await getTwilioWhatsappSandboxToPhone()
  const dest = sandboxTo?.trim() || row.recipient_address
  if (!dest) return null
  return stripWhatsAppPrefix(dest)
}

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
  metadata?: Record<string, unknown> | null
}

/**
 *
 */
export interface WhatsAppDeliveryResult {
  success: boolean
  errorMessage?: string
  permanent?: boolean
}


function isTwilioContentVariablesError(code: number | undefined): boolean {
  return code === 21656 || code === 92007 || code === 50529 || code === 50541
}

async function resolveSandboxContentSid(providerConfig?: Record<string, unknown>): Promise<string | undefined> {
  const fromConfig = providerConfig?.sandbox_content_sid
  if (typeof fromConfig === 'string' && fromConfig.length > 0) return fromConfig
  return getTwilioWhatsappSandboxContentSid()
}

async function shouldUseSandboxTemplate(providerConfig?: Record<string, unknown>): Promise<boolean> {
  if (providerConfig?.use_sandbox_template === true) return true
  return isTwilioWhatsappSandboxTemplateEnabled()
}

// ---------------------------------------------------------------------------
// Twilio BSP
// ---------------------------------------------------------------------------

async function sendViaTwilio(
  row: OutboxWhatsAppRow,
  providerConfig?: Record<string, unknown>,
): Promise<WhatsAppDeliveryResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const fromConfig = providerConfig?.from_number
  const from       =
    (await getTwilioWhatsappFrom()) ??
    (typeof fromConfig === 'string' && fromConfig.length > 0 ? fromConfig : undefined)

  if (!accountSid || !authToken || !from) {
    const missing = [
      ...collectMissingEnv(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN']),
      ...(!from
        ? ['TWILIO_WHATSAPP_FROM|sys_ntf_runtime_cf.twilio_whatsapp_from|provider.from_number']
        : []),
    ]
    logMissingNotificationEnv({
      adapter: 'whatsapp-adapter(twilio)',
      missing,
      outboxId: row.id,
      extra: { tenantOrgId: row.tenant_org_id },
    })
    return {
      success: false,
      errorMessage: 'Twilio WhatsApp credentials not configured (set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN on the server; set TWILIO_WHATSAPP_FROM or provider config from_number)',
      permanent: true,
    }
  }
  const toNumber = await resolveWhatsAppTo(row)
  if (!toNumber) {
    logger.warn('whatsapp-adapter(twilio): no recipient phone number', {
      outboxId: row.id, tenantOrgId: row.tenant_org_id, feature: 'notifications',
    })
    return { success: false, errorMessage: 'No recipient phone number', permanent: true }
  }

  const useSandbox = await shouldUseSandboxTemplate(providerConfig)
  const contentSid = await resolveSandboxContentSid(providerConfig)
  if (useSandbox && !contentSid) {
    logMissingNotificationEnv({
      adapter: 'whatsapp-adapter(twilio)',
      missing: ['TWILIO_WHATSAPP_SANDBOX_CONTENT_SID|sys_ntf_runtime_cf.wa_sandbox_content_sid|provider.sandbox_content_sid'],
      outboxId: row.id,
      extra: { tenantOrgId: row.tenant_org_id, useSandbox: true },
    })
    return {
      success: false,
      errorMessage: 'Twilio WhatsApp sandbox template enabled but TWILIO_WHATSAPP_SANDBOX_CONTENT_SID (or provider config sandbox_content_sid) is missing',
      permanent: true,
    }
  }

  const fromAddr = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`
  const toAddr   = `whatsapp:${toNumber}`

  try {
    const client = twilio(accountSid, authToken)

    let message
    if (useSandbox && contentSid) {
      const varsObj = buildTwilioContentVariables(row, providerConfig)
      const createPayload: Parameters<typeof client.messages.create>[0] = {
        from: fromAddr,
        to:   toAddr,
        contentSid,
      }
      if (Object.keys(varsObj).length > 0) {
        createPayload.contentVariables = JSON.stringify(varsObj)
      }
      message = await client.messages.create(createPayload)
      logger.info('whatsapp-adapter(twilio): sent via content template', {
        outboxId: row.id,
        messageSid: message.sid,
        contentSid,
        contentVariables: varsObj,
        feature: 'notifications',
      })
    } else {
      message = await client.messages.create({
        from: fromAddr,
        to:   toAddr,
        body: row.rendered_body,
      })
      logger.info('whatsapp-adapter(twilio): sent', {
        outboxId: row.id, messageSid: message.sid, feature: 'notifications',
      })
    }

    if (message.errorCode || message.status === 'failed') {
      const msg = message.errorMessage ?? `Twilio message status: ${message.status}`
      logger.error('whatsapp-adapter(twilio): message rejected', new Error(msg), {
        outboxId: row.id,
        code: message.errorCode,
        status: message.status,
        feature: 'notifications',
      })
      return {
        success: false,
        errorMessage: msg,
        permanent: isTwilioContentVariablesError(message.errorCode ?? undefined) || message.errorCode === 63055,
      }
    }

    return { success: true }
  } catch (err) {
    const error = err as { code?: number; message?: string }
    const msg   = error.message ?? 'Unknown Twilio error'
    const permanent =
      error.code === 21211 ||
      error.code === 21614 ||
      error.code === 63055 ||
      isTwilioContentVariablesError(error.code)
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
    logMissingNotificationEnv({
      adapter: 'whatsapp-adapter(meta)',
      missing: collectMissingEnv(['META_WHATSAPP_ACCESS_TOKEN', 'META_WHATSAPP_PHONE_NUMBER_ID']),
      outboxId: row.id,
      extra: { tenantOrgId: row.tenant_org_id },
    })
    return { success: false, errorMessage: 'Meta WhatsApp credentials not configured (META_WHATSAPP_ACCESS_TOKEN / META_WHATSAPP_PHONE_NUMBER_ID)', permanent: false }
  }
  const toNumber = await resolveWhatsAppTo(row)
  if (!toNumber) {
    logger.warn('whatsapp-adapter(meta): no recipient phone number', {
      outboxId: row.id, tenantOrgId: row.tenant_org_id, feature: 'notifications',
    })
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
          to:                toNumber,
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
    const permanent = res.status === 400 || (errBody.error?.code ?? 0) > 131000
    logger.error('whatsapp-adapter(meta): failed', new Error(msg), {
      outboxId: row.id, httpStatus: res.status, permanent, feature: 'notifications',
    })
    return { success: false, errorMessage: msg, permanent }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    logger.error('whatsapp-adapter(meta): network error', err instanceof Error ? err : new Error(msg), {
      outboxId: row.id, feature: 'notifications',
    })
    return { success: false, errorMessage: msg, permanent: false }
  }
}

// ---------------------------------------------------------------------------
// Factory — reads active provider from settings service
// ---------------------------------------------------------------------------

async function deliverViaHqProxy(row: OutboxWhatsAppRow): Promise<WhatsAppDeliveryResult> {
  const hqUrl = await getNtfHqDispatchUrl()
  const hqKey = process.env.NTF_HQ_SERVICE_ROLE_KEY ?? ''

  if (!hqKey) {
    logMissingNotificationEnv({
      adapter: 'whatsapp-adapter',
      missing: collectMissingEnv(['NTF_HQ_SERVICE_ROLE_KEY']),
      outboxId: row.id,
    })
    return { success: false, errorMessage: 'NTF_HQ_SERVICE_ROLE_KEY not configured', permanent: true }
  }

  const toNumber = await resolveWhatsAppTo(row)
  if (!toNumber) {
    return { success: false, errorMessage: 'No recipient phone number', permanent: true }
  }

  const body = JSON.stringify({
    idempotencyKey: row.id,
    tenantOrgId:    row.tenant_org_id,
    channel:        'WHATSAPP',
    recipient:      toNumber,
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
  if (await isNtfDispatchViaHq()) {
    return deliverViaHqProxy(row)
  }

  const provider = await notificationSettingsService.getActiveProvider(row.tenant_org_id, 'WHATSAPP')

  if (!provider) {
    logger.warn('whatsapp-adapter: no active WhatsApp provider', {
      outboxId: row.id,
      tenantOrgId: row.tenant_org_id,
      table: 'org_ntf_channel_provider_cf',
      expectedProvider: 'TWILIO_WHATSAPP|META_WHATSAPP',
      hint: 'Set is_active=true for TWILIO_WHATSAPP and is_enabled=true on org_ntf_settings_cf WHATSAPP',
      feature: 'notifications',
    })
    return { success: false, errorMessage: 'No active WhatsApp provider configured in org_ntf_channel_provider_cf', permanent: false }
  }

  switch (provider.providerCode) {
    case 'TWILIO_WHATSAPP':
      return sendViaTwilio(row, provider.config)
    case 'META_WHATSAPP':
      return sendViaMeta(row)
    default:
      logger.error('whatsapp-adapter: unknown provider', undefined, {
        outboxId: row.id,
        providerCode: provider.providerCode,
        feature: 'notifications',
      })
      return { success: false, errorMessage: `Unknown WhatsApp provider: ${provider.providerCode}`, permanent: true }
  }
}
