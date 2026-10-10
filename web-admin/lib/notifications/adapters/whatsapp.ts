/**
 * WhatsApp delivery adapter — factory supporting two providers:
 *   TWILIO_WHATSAPP  — Twilio as BSP (uses twilio npm package)
 *   META_WHATSAPP    — Meta Cloud API (direct HTTP)
 *
 * Provider selected via org_ntf_channel_provider_cf (active provider for WHATSAPP channel).
 * Live Twilio templates use provider.config.content_templates keyed by event code;
 * customer consent is rechecked at delivery and sandbox recipient overrides are bypassed.
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
import {
  hasTwilioProductionTemplates,
  isTwilioProductionTemplateProvider,
  resolveTwilioProductionTemplate,
} from '@lib/notifications/adapters/whatsapp-template-config'
import { collectMissingEnv, logMissingNotificationEnv } from '@lib/notifications/log-missing-env'
import { stripWhatsAppPrefix } from '@lib/notifications/whatsapp-phone'
import { resolveWhatsAppCustomerEligibility } from '@lib/notifications/whatsapp-customer-eligibility'
import { runShadowOrderCreatedWhatsAppComparison } from '@lib/notifications/shadow-route-comparison'

async function resolveWhatsAppTo(row: OutboxWhatsAppRow, productionTemplate = false): Promise<string | null> {
  // Live templates must use the persisted recipient even when stale sandbox overrides exist.
  const sandboxTo = productionTemplate ? undefined : await getTwilioWhatsappSandboxToPhone()
  const dest = sandboxTo?.trim() || row.recipient_address
  if (!dest) return null
  return stripWhatsAppPrefix(dest)
}

/**
 * Immutable delivery inputs scoped to the tenant that owns the outbox row.
 */
export interface OutboxWhatsAppRow {
  id: string
  tenant_org_id: string
  recipient_address: string | null   // E.164 phone number
  rendered_body: string
  rendered_subject: string | null    // used as template name hint for META API
  event_code: string | null
  retry_count: number
  /** Source order enables a fresh tenant-customer consent check before every send. */
  source_entity_type?: string | null
  source_entity_id?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Outcome used by the dispatcher to distinguish retryable and permanent failures.
 */
export interface WhatsAppDeliveryResult {
  success: boolean
  errorMessage?: string
  permanent?: boolean
  /** Policy blocks must not retry or trigger the transport-failure email fallback. */
  skipped?: boolean
  /**
   * Twilio message SID, captured whenever Twilio returned a Message resource
   * (accepted or rejected-with-response). Absent when the provider call threw
   * before any resource was returned — reconciliation cannot look up a SID
   * that was never issued and must dead-letter that case instead of guessing.
   */
  providerMessageId?: string
}


function isTwilioContentVariablesError(code: number | undefined): boolean {
  return code === 21656 || code === 92007 || code === 50529 || code === 50541
}

/**
 * Classifies a Twilio error/status code shared by the live adapter and the
 * reconciliation pass so permanent-vs-retryable judgment never diverges
 * between "send" time and "reconcile" time.
 * @param code Twilio numeric error code, when known.
 * @returns Whether retrying this exact send is pointless.
 */
export function isTwilioMessagePermanentFailure(code: number | undefined): boolean {
  return (
    code === 21211 || // invalid 'To' number
    code === 21614 || // not SMS/WhatsApp-capable
    code === 63055 || // outside approved template window
    isTwilioContentVariablesError(code)
  )
}

async function resolveSandboxContentSid(providerConfig?: Record<string, unknown>): Promise<string | undefined> {
  const fromConfig = providerConfig?.sandbox_content_sid
  if (typeof fromConfig === 'string' && fromConfig.length > 0) return fromConfig
  return getTwilioWhatsappSandboxContentSid()
}

async function shouldUseSandboxTemplate(providerConfig?: Record<string, unknown>): Promise<boolean> {
  if (typeof providerConfig?.use_sandbox_template === 'boolean') return providerConfig.use_sandbox_template
  return isTwilioWhatsappSandboxTemplateEnabled()
}

// ---------------------------------------------------------------------------
// Twilio BSP
// ---------------------------------------------------------------------------

async function sendViaTwilio(
  row: OutboxWhatsAppRow,
  providerConfig?: Record<string, unknown>,
): Promise<WhatsAppDeliveryResult> {
  const resolution = resolveTwilioProductionTemplate(row, providerConfig)
  if (resolution && 'errorMessage' in resolution) {
    return { success: false, errorMessage: resolution.errorMessage, permanent: true }
  }
  const productionTemplate = resolution && 'contentSid' in resolution ? resolution : null
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
  const toNumber = await resolveWhatsAppTo(row, hasTwilioProductionTemplates(providerConfig))
  if (!toNumber) {
    logger.warn('whatsapp-adapter(twilio): no recipient phone number', {
      outboxId: row.id, tenantOrgId: row.tenant_org_id, feature: 'notifications',
    })
    return { success: false, errorMessage: 'No recipient phone number', permanent: true }
  }

  const useSandbox = productionTemplate === null && await shouldUseSandboxTemplate(providerConfig)
  const contentSid = productionTemplate?.contentSid ?? (useSandbox ? await resolveSandboxContentSid(providerConfig) : undefined)
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
    if (contentSid && (productionTemplate || useSandbox)) {
      const varsObj = productionTemplate?.contentVariables ?? buildTwilioContentVariables(row, providerConfig)
      // Approved Content templates require substitutions without a competing free-text Body.
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
        permanent: isTwilioMessagePermanentFailure(message.errorCode ?? undefined),
        // Twilio still returned a Message resource (with a SID) even though it was rejected;
        // persist it so a later reconciliation pass can look up the authoritative final status.
        providerMessageId: message.sid,
      }
    }

    return { success: true, providerMessageId: message.sid }
  } catch (err) {
    const error = err as { code?: number; message?: string }
    const msg   = error.message ?? 'Unknown Twilio error'
    const permanent = isTwilioMessagePermanentFailure(error.code)
    logger.error('whatsapp-adapter(twilio): failed', new Error(msg), {
      outboxId: row.id, code: error.code, permanent, feature: 'notifications',
    })
    // No Message resource was returned by this throw, so no SID is available to persist.
    // Reconciliation cannot look up a message that never received a provider identity;
    // it must rely on bounded-age dead-letter handling for this attempt instead.
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
 * Deliver through the active tenant provider without degrading live templates to
 * free text. HQ's current body-only proxy contract cannot carry Content templates.
 * @param row Immutable outbox delivery inputs, including the owning tenant ID.
 * @returns Delivery outcome for the dispatcher's retry policy.
 * @example await deliverWhatsAppOutbox(outboxRow)
 */
export async function deliverWhatsAppOutbox(row: OutboxWhatsAppRow): Promise<WhatsAppDeliveryResult> {
  const provider = await notificationSettingsService.getActiveProvider(row.tenant_org_id, 'WHATSAPP')

  // SHADOW-ONLY pilot (plan sections 17.2/22): observes what
  // ResolveEffectiveNotificationRoute would select for ORDER_CREATED →
  // WHATSAPP, in addition to this unchanged legacy path. It never sends,
  // never reserves quota, never touches the outbox claim a second time, and
  // cannot affect `row`, `provider`, or the result this function returns —
  // any failure inside it is swallowed. See
  // lib/notifications/shadow-route-comparison.ts and
  // docs/features/Notification_And_Communication_Hub/STATUS.md (2026-10-09).
  await runShadowOrderCreatedWhatsAppComparison(row, provider)

  const productionTemplate = provider !== null &&
    isTwilioProductionTemplateProvider(provider.providerCode, provider.config)
  if (productionTemplate || row.metadata?.whatsapp_production_template === true) {
    if (!productionTemplate) {
      return { success: false, skipped: true, errorMessage: 'WhatsApp production template provider changed or was disabled after this notification was queued' }
    }
    if (!(await notificationSettingsService.isChannelEnabled(row.tenant_org_id, 'WHATSAPP'))) {
      return { success: false, skipped: true, errorMessage: 'WhatsApp channel was disabled before delivery' }
    }
    const eligibility = await resolveWhatsAppCustomerEligibility(
      row.tenant_org_id, row.source_entity_type, row.source_entity_id,
    )
    if (eligibility.allowed === false) {
      return { success: false, skipped: !eligibility.retryable, permanent: false, errorMessage: eligibility.reason }
    }
    const queuedRecipient = row.recipient_address ? stripWhatsAppPrefix(row.recipient_address).trim() : null
    const awaitingEligibility = queuedRecipient === null && row.metadata?.whatsapp_eligibility_pending === true
    if (!awaitingEligibility && queuedRecipient !== eligibility.recipientAddress) {
      return { success: false, skipped: true, errorMessage: 'WhatsApp queued recipient no longer matches the opted-in tenant customer' }
    }
    // An initial lookup failure can defer address resolution, but only this fresh check authorizes sending.
    row = { ...row, recipient_address: eligibility.recipientAddress }
  }

  if (await isNtfDispatchViaHq()) {
    if (provider && isTwilioProductionTemplateProvider(provider.providerCode, provider.config)) {
      return {
        success: false,
        errorMessage: 'Twilio production content_templates require direct tenant dispatch; disable NTF_DISPATCH_VIA_HQ (including runtime ntf_dispatch_via_hq) or add template support to the HQ proxy contract',
        permanent: true,
      }
    }
    return deliverViaHqProxy(row)
  }

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
