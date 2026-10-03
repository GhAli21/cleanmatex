/**
 * Draft model for the Security & Sessions screen (pure, no React).
 *
 * The screen stores only the items the user touched; everything else is read from the server data.
 * "Dirty" and the save payload are derived from (server item, draft) so there is no effect-driven
 * state syncing.
 */

import { AUTH_CONFIG_SOURCES } from '@/lib/constants/auth-admin-config'
import { validateAuthConfigValue } from '@/lib/auth/auth-config-validation'
import type { AuthConfigChange, AuthConfigItem } from '@/lib/types/auth-admin-config'

/** What the user currently has in the form for one item. */
export interface AuthConfigDraft {
  /** true = use a tenant-specific value; false = use the platform default. */
  useCustom: boolean
  /** Text of the custom value (kept even while "use platform default" is on, so toggling is lossless). */
  text: string
}

/** Draft equivalent to the server state of an item (what the form shows before any edit). */
export function initialDraft(item: AuthConfigItem): AuthConfigDraft {
  const hasEffectiveOverride = item.source === AUTH_CONFIG_SOURCES.TENANT
  return {
    useCustom: hasEffectiveOverride,
    // Start a new custom value from the platform value; an active override starts from its own.
    text: hasEffectiveOverride && item.tenantValue !== null ? item.tenantValue : item.platformValue,
  }
}

/** True when the draft differs from the server state in a way that must be saved. */
export function isDirty(item: AuthConfigItem, draft: AuthConfigDraft): boolean {
  const initial = initialDraft(item)
  if (draft.useCustom !== initial.useCustom) return true
  return draft.useCustom && draft.text.trim() !== initial.text
}

/** Field-level validation error key for a draft, or undefined when valid / not custom. */
export function draftError(item: AuthConfigItem, draft: AuthConfigDraft): 'type' | 'range' | 'not_allowed' | undefined {
  if (!draft.useCustom) return undefined
  const checked = validateAuthConfigValue(item, draft.text)
  return checked.ok ? undefined : checked.reason
}

/**
 * Build the API payload from the touched items.
 *
 * @returns `changes` to send (value null = reset) and whether any touched item is invalid
 */
export function buildChanges(
  items: AuthConfigItem[],
  drafts: Record<string, AuthConfigDraft>
): { changes: AuthConfigChange[]; hasInvalid: boolean } {
  const changes: AuthConfigChange[] = []
  let hasInvalid = false

  for (const item of items) {
    const draft = drafts[item.configCode]
    if (!draft || !item.isAllowTenantChange || !isDirty(item, draft)) continue

    if (!draft.useCustom) {
      changes.push({ configCode: item.configCode, value: null })
      continue
    }
    const checked = validateAuthConfigValue(item, draft.text)
    if (!checked.ok || checked.value === undefined) {
      hasInvalid = true
      continue
    }
    changes.push({ configCode: item.configCode, value: checked.value })
  }

  return { changes, hasInvalid }
}
