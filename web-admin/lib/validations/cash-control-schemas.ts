import { z } from 'zod'
import {
  CASH_CONTROL_ASSIGNMENT_MODE,
  CASH_CONTROL_CHANGE_BEARER,
  CASH_CONTROL_COUNT_MODE,
  CASH_CONTROL_MAX_CASH_ENFORCE_MODE,
  CASH_CONTROL_ROLLOVER_MODE,
  CASH_CONTROL_SHARED_SESSION_MODE,
  CASH_CONTROL_TRACKING_MODE,
  CASH_CONTROL_VARIANCE_GATE_MODE,
} from '@/lib/constants/cash-control'

/**
 * Shared client/server validation for the cash-control settings PUT payload
 * (POS Session & Cash Drawer Hardening, W0-5). Every field mirrors a column
 * on `org_fin_cash_ctrl_stng_cf` (migration 0515) and is optional+nullable:
 * absent = leave untouched, `null` = clear the override (revert to inherit),
 * a value = set the override. See `CashControlSettingsPatch` in
 * `lib/services/cash-control-settings.service.ts`, which this schema's
 * inferred type intentionally matches field-for-field.
 *
 * Threshold ordering (tolerance <= reason <= approval) is enforced by the DB
 * `CHECK chk_ofccs_thr_order` on the full row, not here — this is a partial
 * patch, so the two unmentioned bands are unknown until the DB has the
 * existing row to compare against. A violation surfaces as a 422 from the
 * API route.
 */

function enumValues<T extends string>(obj: Record<string, T>): [T, ...T[]] {
  return Object.values(obj) as [T, ...T[]]
}

export const cashControlSettingsPatchSchema = z.object({
  blindCloseEnabled: z.boolean().nullable().optional(),
  varianceGateMode: z.enum(enumValues(CASH_CONTROL_VARIANCE_GATE_MODE)).nullable().optional(),
  varianceThresholdAmount: z.number().min(0).nullable().optional(),
  varianceReasonAmount: z.number().min(0).nullable().optional(),
  varianceToleranceAmount: z.number().min(0).nullable().optional(),
  cashTrackingMode: z.enum(enumValues(CASH_CONTROL_TRACKING_MODE)).nullable().optional(),
  openingCountMode: z.enum(enumValues(CASH_CONTROL_COUNT_MODE)).nullable().optional(),
  closingCountMode: z.enum(enumValues(CASH_CONTROL_COUNT_MODE)).nullable().optional(),
  cashChangeBearer: z.enum(enumValues(CASH_CONTROL_CHANGE_BEARER)).nullable().optional(),
  cashChangeRoundToMinor: z.number().int().positive().nullable().optional(),
  drawerAssignmentMode: z.enum(enumValues(CASH_CONTROL_ASSIGNMENT_MODE)).nullable().optional(),
  sharedSessionMode: z.enum(enumValues(CASH_CONTROL_SHARED_SESSION_MODE)).nullable().optional(),
  maxCashEnforceMode: z.enum(enumValues(CASH_CONTROL_MAX_CASH_ENFORCE_MODE)).nullable().optional(),
  cashDropRequiresDest: z.boolean().nullable().optional(),
  posSessionReqForCash: z.boolean().nullable().optional(),
  posSessionReqAllTenders: z.boolean().nullable().optional(),
  posSessionRolloverMode: z.enum(enumValues(CASH_CONTROL_ROLLOVER_MODE)).nullable().optional(),
  posSessionStaleHours: z.number().int().positive().nullable().optional(),
  shiftZReportRequired: z.boolean().nullable().optional(),
})

export const updateCashControlSettingsRequestSchema = z.object({
  patch: cashControlSettingsPatchSchema,
  reason: z.string().trim().min(1).max(500).optional(),
})

export type CashControlSettingsPatchInput = z.infer<typeof cashControlSettingsPatchSchema>
export type UpdateCashControlSettingsRequest = z.infer<typeof updateCashControlSettingsRequestSchema>
