import { z } from 'zod'

/** Non-secret provider fields returned by the tenant configuration API. */
export interface NotificationProviderConfig {
  id: string
  provider_code: string
  is_active: boolean
  updated_at: string | null
  config: Record<string, unknown> | null
}

/** Field-oriented editing keeps Twilio substitutions usable without a JSON editor. */
export interface WhatsAppTemplateFormValues {
  event: string
  contentSid: string
  mappings: Array<{ slot: string; kind: 'variable' | 'literal'; source: string }>
}

/**
 * Extract event bindings without interpreting unrelated provider configuration.
 *
 * @param config - Stored provider configuration or null for an unconfigured provider
 * @returns Existing event bindings, or an empty object when none have been configured
 * @throws Error when the stored configuration or template collection is malformed
 */
export function templateBindings(config: Record<string, unknown> | null): Record<string, unknown> {
  if (config !== null && (typeof config !== 'object' || Array.isArray(config))) {
    throw new Error('Invalid provider configuration')
  }
  const bindings = config?.content_templates
  if (bindings === undefined) return {}
  if (typeof bindings !== 'object' || bindings === null || Array.isArray(bindings)) {
    throw new Error('Invalid template configuration')
  }
  return bindings as Record<string, unknown>
}

/**
 * Load an editable binding while keeping unconfigured template SIDs empty.
 * Only order.created receives the known event-data mapping defaults.
 *
 * @param event - Exact persisted notification event code to edit
 * @param config - Existing provider configuration; sibling bindings are not changed
 * @returns Field-oriented values for the selected event
 * @throws Error when the template collection is malformed
 */
export function templateFormValues(event: string, config: Record<string, unknown> | null): WhatsAppTemplateFormValues {
  const binding = templateBindings(config)[event] as { content_sid?: unknown; content_variable_map?: unknown } | undefined
  const map = binding?.content_variable_map
  return {
    event,
    contentSid: typeof binding?.content_sid === 'string' ? binding.content_sid : '',
    mappings: map && typeof map === 'object' && !Array.isArray(map)
      ? Object.entries(map).map(([slot, source]) => ({
        slot,
        kind: typeof source === 'string' && source.startsWith('$') ? 'variable' : 'literal',
        source: typeof source === 'string' ? source.replace(/^\$/, '') : '',
      }))
      : event === 'order.created' ? [
        { slot: 'order_number', kind: 'variable', source: 'order_number' },
        { slot: 'estimated_ready_at', kind: 'variable', source: 'estimated_ready_at' },
      ] : [],
  }
}

/**
 * Build field validation using localized messages for Twilio identifiers and substitutions.
 *
 * @param messages - Resolved locale strings for each validation failure
 * @returns Zod schema validating event codes, Content SIDs, and unique variable mappings
 */
export function whatsappTemplateSchema(messages: { event: string; sid: string; slot: string; source: string; duplicate: string }) {
  return z.object({
    event: z.string().trim().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/, messages.event),
    contentSid: z.string().trim().regex(/^HX[0-9a-fA-F]{32}$/, messages.sid),
    mappings: z.array(z.object({
      slot: z.string().trim().regex(/^(?:[1-9][0-9]*|[a-zA-Z_][a-zA-Z0-9_]*)$/, messages.slot),
      kind: z.enum(['variable', 'literal']),
      source: z.string().trim().min(1, messages.source),
    })).superRefine((rows, context) => {
      const seen = new Set<string>()
      rows.forEach((row, index) => {
        if (seen.has(row.slot)) context.addIssue({ code: 'custom', message: messages.duplicate, path: [index, 'slot'] })
        seen.add(row.slot)
        if (row.kind === 'variable' && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(row.source)) {
          context.addIssue({ code: 'custom', message: messages.source, path: [index, 'source'] })
        }
        if (row.kind === 'literal' && row.source.startsWith('$')) {
          context.addIssue({ code: 'custom', message: messages.source, path: [index, 'source'] })
        }
      })
    }),
  })
}

/**
 * Merge one event binding while preserving unrelated provider options and sibling events.
 * An empty template collection remains explicit so production sending still fails closed.
 *
 * @param config - Provider configuration most recently read from the authenticated tenant
 * @param values - Binding values to save, or an explicit request to remove an event
 * @returns New provider configuration containing the requested change
 * @throws Error when the existing template collection is malformed
 */
export function mergeTemplateBinding(config: Record<string, unknown> | null, values: WhatsAppTemplateFormValues | { event: string; remove: true }): Record<string, unknown> {
  const bindings = { ...templateBindings(config) }
  if ('remove' in values) delete bindings[values.event]
  else bindings[values.event] = {
    content_sid: values.contentSid,
    content_variable_map: Object.fromEntries(values.mappings.map(({ slot, kind, source }) => [slot, kind === 'variable' ? `$${source}` : source])),
  }
  return { ...config, content_templates: bindings }
}
