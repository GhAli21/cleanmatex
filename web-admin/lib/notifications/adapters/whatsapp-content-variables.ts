/**
 * Twilio Content API variable mapping for WhatsApp templates.
 * Named keys must match the approved Content template (e.g. order_created_simple).
 */

export interface WhatsAppContentVariableRow {
  event_code: string | null
  metadata?: Record<string, unknown> | null
}

const NAMED_ORDER_KEYS = [
  'order_number',
  'estimated_ready_at',
  'date',
  'tracking_token',
] as const

/**
 * Strip whitespace/control chars so Twilio ContentVariables stay within slot limits.
 * @param value Raw template variable
 */
export function sanitizeContentVariableValue(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 256)
}

/**
 * Build Twilio ContentVariables JSON keys for a Content template.
 *
 * Provider config `content_variable_map` maps template slot/name → value source:
 *   - `"$order_number"` — from outbox metadata.variables
 *   - `"CleanMateX"`      — literal static text
 *
 * When no map is set, named order-lifecycle keys are passed through so
 * templates like {{order_number}} work without OTP-style {1}/{2} slots.
 *
 * Set `content_variable_map: {}` to send no ContentVariables (static template only).
 * @param row Outbox row with event metadata
 * @param providerConfig Optional org_ntf_channel_provider_cf.config
 */
export function buildTwilioContentVariables(
  row: WhatsAppContentVariableRow,
  providerConfig?: Record<string, unknown>,
): Record<string, string> {
  const eventVars = (row.metadata?.variables as Record<string, string> | undefined) ?? {}
  const map = providerConfig?.content_variable_map

  if (map !== undefined && map !== null && typeof map === 'object' && !Array.isArray(map)) {
    const result: Record<string, string> = {}
    for (const [slot, source] of Object.entries(map as Record<string, unknown>)) {
      if (typeof source !== 'string') continue
      const raw =
        source.startsWith('$')
          ? (eventVars[source.slice(1)] ?? row.event_code ?? '')
          : source
      const cleaned = sanitizeContentVariableValue(String(raw))
      if (cleaned.length > 0) result[slot] = cleaned
    }
    return result
  }

  const named: Record<string, string> = {}
  for (const key of NAMED_ORDER_KEYS) {
    const raw = eventVars[key]
    if (typeof raw !== 'string' || raw.trim().length === 0) continue
    named[key] = sanitizeContentVariableValue(raw)
  }
  if (Object.keys(named).length > 0) return named

  const code = sanitizeContentVariableValue(
    eventVars.otp ??
      eventVars.code ??
      row.event_code ??
      'notification',
  )
  const label = sanitizeContentVariableValue(
    row.event_code?.replace(/\./g, ' ') ?? 'CleanMateX',
  )
  return { '1': label, '2': code }
}
