import {
  POS_SESSION_SURFACE_SETTING_FIELD,
  type CashControlSettings,
} from '@lib/constants/cash-control'
import { POS_SESSION_SURFACE } from '@lib/constants/pos-session'

/** Tabs of the POS settings page, in display order. The id doubles as the `?tab=` deep-link value. */
export const POS_SETTINGS_TAB = {
  REQUIREMENT: 'requirement',
  LIFECYCLE: 'lifecycle',
} as const

export type PosSettingsTab = (typeof POS_SETTINGS_TAB)[keyof typeof POS_SETTINGS_TAB]

export const POS_SETTINGS_TAB_ORDER: readonly PosSettingsTab[] = [
  POS_SETTINGS_TAB.REQUIREMENT,
  POS_SETTINGS_TAB.LIFECYCLE,
]

/** One POS-session requirement selector per finance screen, in display order. */
export const POS_SESSION_SURFACE_FIELDS = [
  POS_SESSION_SURFACE_SETTING_FIELD[POS_SESSION_SURFACE.ORDER_ENTRY],
  POS_SESSION_SURFACE_SETTING_FIELD[POS_SESSION_SURFACE.LATER_COLLECTION],
  POS_SESSION_SURFACE_SETTING_FIELD[POS_SESSION_SURFACE.STORED_VALUE_SALE],
  POS_SESSION_SURFACE_SETTING_FIELD[POS_SESSION_SURFACE.CASH_REFUND],
  POS_SESSION_SURFACE_SETTING_FIELD[POS_SESSION_SURFACE.CUSTOMER_RECEIPT],
  POS_SESSION_SURFACE_SETTING_FIELD[POS_SESSION_SURFACE.MANUAL_VOUCHER],
] as const

/**
 * Settings this page edits. Everything else in the resolved cash-control policy (drawer close,
 * custody, cash-change rounding, denominations) belongs to the Cash Control Settings page.
 */
export type PosSettingsField =
  | (typeof POS_SESSION_SURFACE_FIELDS)[number]
  | 'posSessionRolloverMode'
  | 'posSessionStaleHours'
  | 'shiftZReportRequired'

/**
 * Which tab edits which setting. Typed over every editable key so adding a setting without placing
 * it on a tab fails the type check — a setting must never be saveable yet unreachable.
 */
export const POS_SETTINGS_FIELD_TAB: Record<PosSettingsField, PosSettingsTab> = {
  posSessionModeOrderEntry: POS_SETTINGS_TAB.REQUIREMENT,
  posSessionModeLaterColl: POS_SETTINGS_TAB.REQUIREMENT,
  posSessionModeStoredVal: POS_SETTINGS_TAB.REQUIREMENT,
  posSessionModeCashRefd: POS_SETTINGS_TAB.REQUIREMENT,
  posSessionModeCustRcpt: POS_SETTINGS_TAB.REQUIREMENT,
  posSessionModeManualVchr: POS_SETTINGS_TAB.REQUIREMENT,

  posSessionRolloverMode: POS_SETTINGS_TAB.LIFECYCLE,
  posSessionStaleHours: POS_SETTINGS_TAB.LIFECYCLE,
  shiftZReportRequired: POS_SETTINGS_TAB.LIFECYCLE,
}

/** The editable POS fields, derived from the tab map so the two can never disagree. */
export const POS_SETTINGS_FIELDS = Object.keys(POS_SETTINGS_FIELD_TAB) as PosSettingsField[]

/** Falls back to the first tab for a missing or unknown `?tab=` value. */
export function resolvePosSettingsTab(value: string | null | undefined): PosSettingsTab {
  return POS_SETTINGS_TAB_ORDER.find((tab) => tab === value) ?? POS_SETTINGS_TAB.REQUIREMENT
}

/** Number of unsaved fields on each tab, from RHF's dirty-field map. */
export function countDirtyFieldsByTab(
  dirtyFields: Partial<Record<string, unknown>>
): Record<PosSettingsTab, number> {
  const counts: Record<PosSettingsTab, number> = {
    [POS_SETTINGS_TAB.REQUIREMENT]: 0,
    [POS_SETTINGS_TAB.LIFECYCLE]: 0,
  }
  for (const [field, dirty] of Object.entries(dirtyFields)) {
    const tab = POS_SETTINGS_FIELD_TAB[field as PosSettingsField]
    if (dirty && tab) counts[tab] += 1
  }
  return counts
}

/** Narrows the full resolved policy to the fields this page owns. */
export function pickPosSettings(settings: CashControlSettings): Pick<CashControlSettings, PosSettingsField> {
  const picked = {} as Record<PosSettingsField, unknown>
  for (const field of POS_SETTINGS_FIELDS) picked[field] = settings[field]
  return picked as Pick<CashControlSettings, PosSettingsField>
}
