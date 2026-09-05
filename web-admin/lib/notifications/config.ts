/**
 * Notification Hub — runtime feature flags (env-driven).
 * Used for test/sandbox behaviour without DB migrations.
 */

/** When true, WHATSAPP deliveries fall back to customer EMAIL when WA is unavailable or fails. */
export function isWhatsappEmailFallbackEnabled(): boolean {
  const explicit = process.env.NTF_WHATSAPP_FALLBACK_EMAIL;
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

/**
 * When false, the legacy `/api/v1/orders/[id]/transition` compat route skips
 * its `order.ready` / `order.cancelled` notification entirely. Defaults to
 * on; set NTF_ORDER_TRANSITION_NOTIFY=false to pause this one notify path
 * without touching the shared sys_ntf_events_cd/sys_ntf_event_chan_map config
 * (which any other future caller of these event codes would also share).
 */
export function isOrderTransitionNotifyEnabled(): boolean {
  return false; //process.env.NTF_ORDER_TRANSITION_NOTIFY !== 'false';
}

/** When true, Twilio BSP sends via Content API sandbox template instead of free-form body. */
export function isTwilioWhatsappSandboxTemplateEnabled(): boolean {
  return process.env.TWILIO_WHATSAPP_USE_SANDBOX_TEMPLATE === 'true';
}

/** Twilio Content SID for sandbox template "Your {1} code is {2}". */
export function getTwilioWhatsappSandboxContentSid(): string | undefined {
  return process.env.TWILIO_WHATSAPP_SANDBOX_CONTENT_SID || undefined;
}
