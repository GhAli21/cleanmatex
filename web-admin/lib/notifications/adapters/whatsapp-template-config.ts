/**
 * Event-specific Twilio template configuration is deliberately strict: an enabled
 * template catalog must never degrade to a different event's template or free text.
 */
import {
  sanitizeContentVariableValue,
  type WhatsAppContentVariableRow,
} from '@lib/notifications/adapters/whatsapp-content-variables'

/** Validated production payload or an actionable configuration failure. */
export type TwilioProductionTemplateResolution =
  | { contentSid: string; contentVariables: Record<string, string> }
  | { errorMessage: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Detect an explicit live catalog even when malformed, so stale sandbox settings
 * cannot mask a production configuration error or redirect customer messages.
 * @param config Tenant provider JSON configuration.
 * @returns Whether the tenant explicitly selected event-specific templates.
 */
export function hasTwilioProductionTemplates(config?: Record<string, unknown>): boolean {
  return config !== undefined && Object.prototype.hasOwnProperty.call(config, 'content_templates')
}

/**
 * Identify the provider surface requiring live recipient and customer consent checks.
 * @param providerCode Active provider's persisted code.
 * @param config Tenant provider JSON configuration.
 * @returns Whether the active provider uses Twilio production templates.
 */
export function isTwilioProductionTemplateProvider(
  providerCode: string,
  config?: Record<string, unknown>,
): boolean {
  return providerCode === 'TWILIO_WHATSAPP' && hasTwilioProductionTemplates(config)
}

/**
 * Reject invalid live catalogs before provider activation can deactivate the current provider.
 * Send-time resolution still validates actual substitutions independently.
 * @param config Proposed tenant provider configuration from an authenticated operator.
 * @returns A configuration error, or null when the catalog shape is safe to save.
 */
export function validateTwilioProductionTemplateConfig(config: unknown): string | null {
  if (!isRecord(config)) return 'Provider config must be an object'
  if (!hasTwilioProductionTemplates(config)) return null
  if (!isRecord(config.content_templates)) return 'Twilio content_templates must be an object'
  for (const [eventCode, template] of Object.entries(config.content_templates)) {
    if (!eventCode.trim() || !isRecord(template)) return 'Each Twilio template requires an event code and configuration object'
    if (typeof template.content_sid !== 'string' || !/^HX[0-9a-fA-F]{32}$/.test(template.content_sid)) {
      return `Twilio template ${eventCode} requires a valid Content SID`
    }
    if (!isRecord(template.content_variable_map) || Object.keys(template.content_variable_map).length > 100) {
      return `Twilio template ${eventCode} requires a variable map with at most 100 entries`
    }
    for (const [slot, source] of Object.entries(template.content_variable_map)) {
      if (!/^[a-zA-Z0-9_$]+$/.test(slot) || typeof source !== 'string' || !source.trim() || source === '$') {
        return `Twilio template ${eventCode} has an invalid variable mapping`
      }
    }
  }
  return null
}

/**
 * Resolve only the current event's approved Content SID and explicit variable map.
 * Missing substitutions fail before a provider call; no event-code fallback is safe
 * for an approved transactional template.
 * @param row Outbox event and its immutable substitution metadata.
 * @param config Tenant provider JSON configuration.
 * @returns Null for legacy mode, a validated template, or a configuration error.
 */
export function resolveTwilioProductionTemplate(
  row: WhatsAppContentVariableRow,
  config?: Record<string, unknown>,
): TwilioProductionTemplateResolution | null {
  if (!hasTwilioProductionTemplates(config)) return null
  const templates = config?.content_templates
  if (!isRecord(templates)) {
    return { errorMessage: 'Twilio provider content_templates must be an object keyed by notification event code' }
  }
  const eventCode = row.event_code
  if (!eventCode || !Object.prototype.hasOwnProperty.call(templates, eventCode)) {
    return { errorMessage: `No Twilio content_templates entry configured for event ${eventCode ?? '(missing)'}; configure its approved Content SID and variable map` }
  }
  const template = templates[eventCode]
  if (!isRecord(template)) {
    return { errorMessage: `Twilio content_templates entry for ${eventCode} must be an object` }
  }
  const contentSid = template.content_sid
  // Twilio Content identifiers use HX plus a 32-character hex token; reject other resource SIDs locally.
  if (typeof contentSid !== 'string' || !/^HX[0-9a-fA-F]{32}$/.test(contentSid)) {
    return { errorMessage: `Twilio content_templates entry for ${eventCode} requires a valid content_sid (HX followed by 32 hexadecimal characters)` }
  }
  const map = template.content_variable_map
  if (!isRecord(map)) {
    return { errorMessage: `Twilio content_templates entry for ${eventCode} requires content_variable_map as an object of template keys to string sources; use {} for a static template` }
  }
  const eventVariables = row.metadata?.variables
  const variables = isRecord(eventVariables) ? eventVariables : {}
  // Template slot names originate in JSON; retain even object-prototype names as data.
  const contentVariables = Object.create(null) as Record<string, string>
  for (const [slot, source] of Object.entries(map)) {
    if (!slot.trim() || typeof source !== 'string') {
      return { errorMessage: `Twilio content_variable_map for ${eventCode} requires nonempty template keys and string sources` }
    }
    // A $ prefix opts into immutable event metadata; unprefixed strings are intentional literals.
    const rawValue = source.startsWith('$')
      ? (Object.prototype.hasOwnProperty.call(variables, source.slice(1)) ? variables[source.slice(1)] : undefined)
      : source
    if (typeof rawValue !== 'string' || !sanitizeContentVariableValue(rawValue)) {
      return { errorMessage: `Twilio template variable ${slot} for ${eventCode} is missing or empty; provide ${source.startsWith('$') ? `metadata.variables.${source.slice(1)}` : 'a nonempty literal value'}` }
    }
    contentVariables[slot] = sanitizeContentVariableValue(rawValue)
  }
  return { contentSid, contentVariables }
}
