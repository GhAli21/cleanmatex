/**
 * Client-side redaction before storing session activity entries.
 * Truncates length and strips common secret patterns.
 */

import {
  SESSION_ACTIVITY_DESCRIPTION_MAX,
  SESSION_ACTIVITY_TITLE_MAX,
} from './session-activity-config'

const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g

function redactSecrets(value: string): string {
  return value
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED_JWT]')
    .replace(CARD_PATTERN, '[REDACTED_CARD]')
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

/**
 * Redact and truncate a title for storage.
 */
export function redactSessionTitle(title: string): string {
  return truncate(redactSecrets(title.trim()), SESSION_ACTIVITY_TITLE_MAX)
}

/**
 * Redact and truncate an optional description for storage.
 */
export function redactSessionDescription(description?: string): string | undefined {
  if (!description) return undefined
  const cleaned = truncate(redactSecrets(description.trim()), SESSION_ACTIVITY_DESCRIPTION_MAX)
  return cleaned.length > 0 ? cleaned : undefined
}
