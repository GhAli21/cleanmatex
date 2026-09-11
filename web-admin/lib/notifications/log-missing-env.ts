/**
 * Structured missing-env logging for notification adapters.
 * Names only — never log SID/token/key values.
 */

import { logger } from '@lib/utils/logger'

/**
 * Returns env names that are unset or blank.
 *
 * @param names - Process env keys to inspect
 * @returns Keys with no usable value
 */
export function collectMissingEnv(names: string[]): string[] {
  return names.filter((name) => {
    const value = process.env[name]
    return typeof value !== 'string' || value.trim().length === 0
  })
}

/**
 * Logs which notification env/runtime keys are missing without printing secrets.
 *
 * @param params.adapter - Adapter label for the log line
 * @param params.missing - Env or runtime key names that were empty
 * @param params.outboxId - Optional outbox row id
 * @param params.extra - Extra structured context (no secret values)
 */
export function logMissingNotificationEnv(params: {
  adapter: string
  missing: string[]
  outboxId?: string
  extra?: Record<string, unknown>
}): void {
  if (params.missing.length === 0) return

  logger.error(`${params.adapter}: missing required env or runtime values`, undefined, {
    missing: params.missing,
    outboxId: params.outboxId,
    feature: 'notifications',
    ...params.extra,
  })
}
