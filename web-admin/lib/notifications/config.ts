/**
 * Notification Hub runtime flags.
 * Source of truth: sys_ntf_runtime_cf (see migration 0502).
 * Explicit env values still override so .env.local works before the
 * migration is applied and as an emergency escape hatch.
 * Secrets (Twilio auth, Resend key, HQ service role) stay in env only.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@lib/utils/logger'
import { parseRuntimeBool, resolveRuntimeString } from '@lib/notifications/runtime-config-helpers'

export { parseRuntimeBool, resolveRuntimeString } from '@lib/notifications/runtime-config-helpers'

/** Keys stored in sys_ntf_runtime_cf — keep in sync with 0502 / 0503. */
export const NTF_RUNTIME_KEYS = {
  WHATSAPP_FALLBACK_EMAIL: 'whatsapp_fallback_email',
  ORDER_TRANSITION_NOTIFY: 'order_transition_notify',
  WA_USE_SANDBOX_TEMPLATE: 'wa_use_sandbox_template',
  WA_SANDBOX_CONTENT_SID: 'wa_sandbox_content_sid',
  WA_SANDBOX_TO_PHONE: 'wa_sandbox_to_phone',
  OUTBOX_INLINE_DISPATCH: 'outbox_inline_dispatch',
  TWILIO_SMS_FROM: 'twilio_sms_from',
  TWILIO_WHATSAPP_FROM: 'twilio_whatsapp_from',
  NTF_DISPATCH_VIA_HQ: 'ntf_dispatch_via_hq',
  NTF_HQ_DISPATCH_URL: 'ntf_hq_dispatch_url',
  RESEND_FROM_EMAIL: 'resend_from_email',
} as const

const ENV_OVERRIDE: Record<string, string> = {
  [NTF_RUNTIME_KEYS.WHATSAPP_FALLBACK_EMAIL]: 'NTF_WHATSAPP_FALLBACK_EMAIL',
  [NTF_RUNTIME_KEYS.ORDER_TRANSITION_NOTIFY]: 'NTF_ORDER_TRANSITION_NOTIFY',
  [NTF_RUNTIME_KEYS.WA_USE_SANDBOX_TEMPLATE]: 'TWILIO_WHATSAPP_USE_SANDBOX_TEMPLATE',
  [NTF_RUNTIME_KEYS.WA_SANDBOX_CONTENT_SID]: 'TWILIO_WHATSAPP_SANDBOX_CONTENT_SID',
  [NTF_RUNTIME_KEYS.WA_SANDBOX_TO_PHONE]: 'TWILIO_WHATSAPP_SANDBOX_TO',
  [NTF_RUNTIME_KEYS.OUTBOX_INLINE_DISPATCH]: 'NTF_OUTBOX_INLINE_DISPATCH',
  [NTF_RUNTIME_KEYS.TWILIO_SMS_FROM]: 'TWILIO_SMS_FROM',
  [NTF_RUNTIME_KEYS.TWILIO_WHATSAPP_FROM]: 'TWILIO_WHATSAPP_FROM',
  [NTF_RUNTIME_KEYS.NTF_DISPATCH_VIA_HQ]: 'NTF_DISPATCH_VIA_HQ',
  [NTF_RUNTIME_KEYS.NTF_HQ_DISPATCH_URL]: 'NTF_HQ_DISPATCH_URL',
  [NTF_RUNTIME_KEYS.RESEND_FROM_EMAIL]: 'RESEND_FROM_EMAIL',
}

const CACHE_TTL_MS = 30_000

interface RuntimeCache {
  values: Map<string, string>
  expiresAt: number
}

let cache: RuntimeCache | null = null

/**
 * Drop the 30s sys_ntf_runtime_cf cache after an operator write.
 */
export function invalidateNtfRuntimeCache(): void {
  cache = null
}

async function loadRuntimeMap(): Promise<Map<string, string>> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) return cache.values

  const values = new Map<string, string>()
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('sys_ntf_runtime_cf')
      .select('key, value')
      .eq('is_active', true)
      .eq('rec_status', 1)

    if (error) {
      logger.warn('ntf-runtime-cf: failed to load hub flags', {
        error: error.message,
        feature: 'notifications',
      })
    } else {
      for (const row of data ?? []) {
        if (row.key && row.value != null) values.set(row.key, row.value)
      }
    }
  } catch (err) {
    logger.warn('ntf-runtime-cf: load threw', {
      error: err instanceof Error ? err.message : String(err),
      feature: 'notifications',
    })
  }

  cache = { values, expiresAt: now + CACHE_TTL_MS }
  return values
}

async function getRuntimeString(key: string, fallback?: string): Promise<string | undefined> {
  const envName = ENV_OVERRIDE[key]
  const dbMap = await loadRuntimeMap()
  return resolveRuntimeString({
    envValue: envName ? process.env[envName] : undefined,
    dbValue: dbMap.get(key),
    fallback,
  })
}

async function getRuntimeBool(key: string, fallback: boolean): Promise<boolean> {
  const parsed = parseRuntimeBool(await getRuntimeString(key))
  return parsed ?? fallback
}

/** When true, WHATSAPP deliveries fall back to customer EMAIL when WA cannot send. */
export async function isWhatsappEmailFallbackEnabled(): Promise<boolean> {
  return getRuntimeBool(
    NTF_RUNTIME_KEYS.WHATSAPP_FALLBACK_EMAIL,
    process.env.NODE_ENV !== 'production',
  )
}

/**
 * Legacy `/api/v1/orders/[id]/transition` order.ready / order.cancelled notify path.
 * Default false — the shared event catalog is the durable notify path.
 */
export async function isOrderTransitionNotifyEnabled(): Promise<boolean> {
  return getRuntimeBool(NTF_RUNTIME_KEYS.ORDER_TRANSITION_NOTIFY, false)
}

/** When true, Twilio BSP sends via Content API template instead of free-form body. */
export async function isTwilioWhatsappSandboxTemplateEnabled(): Promise<boolean> {
  return getRuntimeBool(NTF_RUNTIME_KEYS.WA_USE_SANDBOX_TEMPLATE, false)
}

/** Twilio Content SID used when sandbox/template sending is on. */
export async function getTwilioWhatsappSandboxContentSid(): Promise<string | undefined> {
  return getRuntimeString(NTF_RUNTIME_KEYS.WA_SANDBOX_CONTENT_SID)
}

/**
 * Optional sandbox destination. Empty = use customer / order mobile.
 * Must be a number that has joined the Twilio sandbox.
 */
export async function getTwilioWhatsappSandboxToPhone(): Promise<string | undefined> {
  return getRuntimeString(NTF_RUNTIME_KEYS.WA_SANDBOX_TO_PHONE)
}

/** When true, WhatsApp outbox rows are dispatched in-process instead of waiting for pg_cron. */
export async function isOutboxInlineDispatchEnabled(): Promise<boolean> {
  return getRuntimeBool(NTF_RUNTIME_KEYS.OUTBOX_INLINE_DISPATCH, false)
}

/** Twilio SMS From number (E.164). Auth stays in TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN. */
export async function getTwilioSmsFrom(): Promise<string | undefined> {
  return getRuntimeString(NTF_RUNTIME_KEYS.TWILIO_SMS_FROM)
}

/** Twilio WhatsApp From address (`whatsapp:+E.164` or `+E.164`). */
export async function getTwilioWhatsappFrom(): Promise<string | undefined> {
  return getRuntimeString(NTF_RUNTIME_KEYS.TWILIO_WHATSAPP_FROM)
}

/** When true, EMAIL/SMS/WA/PUSH are sent through the HQ dispatch proxy. */
export async function isNtfDispatchViaHq(): Promise<boolean> {
  return getRuntimeBool(NTF_RUNTIME_KEYS.NTF_DISPATCH_VIA_HQ, false)
}

/** HQ dispatch URL. The service-role key stays in NTF_HQ_SERVICE_ROLE_KEY. */
export async function getNtfHqDispatchUrl(): Promise<string> {
  return (
    (await getRuntimeString(NTF_RUNTIME_KEYS.NTF_HQ_DISPATCH_URL)) ??
    'http://localhost:3002/api/hq/v1/notifications/dispatch'
  )
}

/** Resend From address. RESEND_API_KEY stays in env. */
export async function getResendFromEmail(): Promise<string> {
  return (
    (await getRuntimeString(NTF_RUNTIME_KEYS.RESEND_FROM_EMAIL)) ??
    'noreply@service.cleanmatex.com'
  )
}
