/**
 * Notification Hub configuration for the tenant app.
 *
 * Source of truth: the Config Registry (`sys_ops_config_cf`, managed on HQ /ops/config), read through
 * the tenant resolver (lib/ops-config/tenant-config-resolver.ts) which applies each key's source
 * policy. The seeded policy for every key here is ENV_OVERRIDES_DB, so a set environment variable
 * still wins (local .env and emergency override keep working) and the stored value is the fallback.
 * The former store `sys_ntf_runtime_cf` is retired (R6b).
 *
 * Provider secrets live in lib/notifications/provider-secrets.ts (same resolver, separate module so
 * flag consumers never import secret getters). `NTF_HQ_SERVICE_ROLE_KEY` is a bootstrap key and stays
 * in the host environment.
 */

import { resolveTenantConfig } from '@lib/ops-config/tenant-config-resolver'
import { parseRuntimeBool } from '@lib/notifications/runtime-config-helpers'

export { parseRuntimeBool, resolveRuntimeString } from '@lib/notifications/runtime-config-helpers'

/**
 * Registry keys read by the tenant notification code, with the environment variable each one
 * used before the registry (also the fallback when the registry is unreadable). Keys mirror
 * `sys_ops_config_cf.config_key` exactly.
 */
export const NTF_CONFIG_KEYS = {
  WHATSAPP_FALLBACK_EMAIL: { key: 'ntf.app.whatsapp_fallback_email', env: 'NTF_WHATSAPP_FALLBACK_EMAIL' },
  ORDER_TRANSITION_NOTIFY: { key: 'ntf.app.order_transition_notify', env: 'NTF_ORDER_TRANSITION_NOTIFY' },
  WA_USE_SANDBOX_TEMPLATE: { key: 'ntf.app.wa_use_sandbox_template', env: 'TWILIO_WHATSAPP_USE_SANDBOX_TEMPLATE' },
  WA_SANDBOX_CONTENT_SID: { key: 'ntf.app.wa_sandbox_content_sid', env: 'TWILIO_WHATSAPP_SANDBOX_CONTENT_SID' },
  WA_SANDBOX_TO_PHONE: { key: 'ntf.app.wa_sandbox_to_phone', env: 'TWILIO_WHATSAPP_SANDBOX_TO' },
  OUTBOX_INLINE_DISPATCH: { key: 'ntf.app.outbox_inline_dispatch', env: 'NTF_OUTBOX_INLINE_DISPATCH' },
  TWILIO_SMS_FROM: { key: 'ntf.app.twilio_sms_from', env: 'TWILIO_SMS_FROM' },
  TWILIO_WHATSAPP_FROM: { key: 'ntf.app.twilio_whatsapp_from', env: 'TWILIO_WHATSAPP_FROM' },
  DISPATCH_VIA_HQ: { key: 'ntf.app.dispatch_via_hq', env: 'NTF_DISPATCH_VIA_HQ' },
  HQ_DISPATCH_URL: { key: 'ntf.app.hq_dispatch_url', env: 'NTF_HQ_DISPATCH_URL' },
  HQ_ROUTE_DISPATCH_URL: { key: 'ntf.app.hq_route_dispatch_url', env: 'NTF_HQ_ROUTE_DISPATCH_URL' },
  RESEND_FROM_EMAIL: { key: 'ntf.app.resend_from_email', env: 'RESEND_FROM_EMAIL' },
} as const

/** One entry of {@link NTF_CONFIG_KEYS}. */
export type NtfConfigKey = (typeof NTF_CONFIG_KEYS)[keyof typeof NTF_CONFIG_KEYS]

/** Resolves one notification key (undefined when unset or refused by its policy). */
export async function getNtfConfig(entry: NtfConfigKey): Promise<string | undefined> {
  return resolveTenantConfig(entry.key, entry.env)
}

async function getConfigBool(entry: NtfConfigKey, fallback: boolean): Promise<boolean> {
  return parseRuntimeBool(await getNtfConfig(entry)) ?? fallback
}

/** When true, WHATSAPP deliveries fall back to customer EMAIL when WA cannot send. */
export async function isWhatsappEmailFallbackEnabled(): Promise<boolean> {
  return getConfigBool(NTF_CONFIG_KEYS.WHATSAPP_FALLBACK_EMAIL, process.env.NODE_ENV !== 'production')
}

/**
 * Legacy `/api/v1/orders/[id]/transition` order.ready / order.cancelled notify path.
 * Default false — the shared event catalog is the durable notify path.
 */
export async function isOrderTransitionNotifyEnabled(): Promise<boolean> {
  return getConfigBool(NTF_CONFIG_KEYS.ORDER_TRANSITION_NOTIFY, false)
}

/** When true, Twilio BSP sends via Content API template instead of free-form body. */
export async function isTwilioWhatsappSandboxTemplateEnabled(): Promise<boolean> {
  return getConfigBool(NTF_CONFIG_KEYS.WA_USE_SANDBOX_TEMPLATE, false)
}

/** Twilio Content SID used when sandbox/template sending is on. */
export async function getTwilioWhatsappSandboxContentSid(): Promise<string | undefined> {
  return getNtfConfig(NTF_CONFIG_KEYS.WA_SANDBOX_CONTENT_SID)
}

/**
 * Optional sandbox destination. Empty = use customer / order mobile.
 * Must be a number that has joined the Twilio sandbox.
 */
export async function getTwilioWhatsappSandboxToPhone(): Promise<string | undefined> {
  return getNtfConfig(NTF_CONFIG_KEYS.WA_SANDBOX_TO_PHONE)
}

/** When true, WhatsApp outbox rows are dispatched in-process instead of waiting for pg_cron. */
export async function isOutboxInlineDispatchEnabled(): Promise<boolean> {
  return getConfigBool(NTF_CONFIG_KEYS.OUTBOX_INLINE_DISPATCH, false)
}

/** Twilio SMS From number (E.164). */
export async function getTwilioSmsFrom(): Promise<string | undefined> {
  return getNtfConfig(NTF_CONFIG_KEYS.TWILIO_SMS_FROM)
}

/** Twilio WhatsApp From address (`whatsapp:+E.164` or `+E.164`). */
export async function getTwilioWhatsappFrom(): Promise<string | undefined> {
  return getNtfConfig(NTF_CONFIG_KEYS.TWILIO_WHATSAPP_FROM)
}

/** When true, EMAIL/SMS/WA/PUSH are sent through the HQ dispatch proxy. */
export async function isNtfDispatchViaHq(): Promise<boolean> {
  return getConfigBool(NTF_CONFIG_KEYS.DISPATCH_VIA_HQ, false)
}

/** HQ dispatch URL. The service-role key stays in NTF_HQ_SERVICE_ROLE_KEY (bootstrap, host environment). */
export async function getNtfHqDispatchUrl(): Promise<string> {
  return (await getNtfConfig(NTF_CONFIG_KEYS.HQ_DISPATCH_URL)) ?? 'http://localhost:3002/api/hq/v1/notifications/dispatch'
}

/**
 * Route-identity-aware HQ dispatch URL — additive to {@link getNtfHqDispatchUrl}'s generic
 * body-only proxy, never a replacement. Used only by the bounded WhatsApp route cutover
 * (plan sections 17.2/22/23.1) once ResolveEffectiveNotificationRoute returns a matched
 * ACTIVE route.
 */
export async function getNtfHqRouteDispatchUrl(): Promise<string> {
  return (
    (await getNtfConfig(NTF_CONFIG_KEYS.HQ_ROUTE_DISPATCH_URL)) ??
    'http://localhost:3002/api/hq/v1/notifications/dispatch/route'
  )
}

/** Resend From address. */
export async function getResendFromEmail(): Promise<string> {
  return (await getNtfConfig(NTF_CONFIG_KEYS.RESEND_FROM_EMAIL)) ?? 'noreply@service.cleanmatex.com'
}
