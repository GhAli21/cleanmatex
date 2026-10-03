/**
 * Cash-control settings — single source of truth (POS Session & Cash Drawer
 * Hardening, W0-3).
 *
 * Backs `org_fin_cash_ctrl_stng_cf` (migration 0515). Every enum string value
 * here is DB-mirrored exactly (CRITICAL RULE #12) against the table's `CHECK`
 * constraints — see
 * docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md §3.1.2/§3.1.4.
 *
 * This file only defines shape, defaults and DB-mirrored codes. Resolution
 * (scope precedence, DB reads, fallback-on-malformed-data) lives in the single
 * resolver service, `lib/services/cash-control-settings.service.ts` — do not
 * read `org_fin_cash_ctrl_stng_cf` anywhere else.
 */

import {
  POS_SESSION_REQUIREMENT_MODE,
  POS_SESSION_SURFACE,
  type PosSessionRequirementMode,
  type PosSessionSurface,
} from '@/lib/constants/pos-session';

// ========================
// Scope
// ========================

/** Mirrors org_fin_cash_ctrl_stng_cf.scope_level. */
export const CASH_CONTROL_SCOPE_LEVEL = {
  TENANT: 'TENANT',
  BRANCH: 'BRANCH',
  USER: 'USER',
  DRAWER: 'DRAWER',
} as const;

export type CashControlScopeLevel =
  (typeof CASH_CONTROL_SCOPE_LEVEL)[keyof typeof CASH_CONTROL_SCOPE_LEVEL];

/**
 * Resolution order, highest precedence first. Declared once — the resolver
 * service imports this rather than hardcoding the chain a second time.
 */
export const CASH_CONTROL_SCOPE_RESOLUTION_ORDER: readonly CashControlScopeLevel[] = [
  CASH_CONTROL_SCOPE_LEVEL.DRAWER,
  CASH_CONTROL_SCOPE_LEVEL.USER,
  CASH_CONTROL_SCOPE_LEVEL.BRANCH,
  CASH_CONTROL_SCOPE_LEVEL.TENANT,
];

// ========================
// Enum value catalogs (DB-mirrored)
// ========================

export const CASH_CONTROL_VARIANCE_GATE_MODE = {
  OFF: 'OFF',
  WARN_ONLY: 'WARN_ONLY',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
} as const;
export type CashControlVarianceGateMode =
  (typeof CASH_CONTROL_VARIANCE_GATE_MODE)[keyof typeof CASH_CONTROL_VARIANCE_GATE_MODE];

export const CASH_CONTROL_TRACKING_MODE = {
  TOTAL_ONLY: 'TOTAL_ONLY',
  COUNT_BY_DENOMINATION: 'COUNT_BY_DENOMINATION',
  FULL_DENOMINATION_TRACKING: 'FULL_DENOMINATION_TRACKING',
} as const;
export type CashControlTrackingMode =
  (typeof CASH_CONTROL_TRACKING_MODE)[keyof typeof CASH_CONTROL_TRACKING_MODE];

export const CASH_CONTROL_COUNT_MODE = {
  TOTAL_ONLY: 'TOTAL_ONLY',
  OPTIONAL_DENOMINATION: 'OPTIONAL_DENOMINATION',
  DENOMINATION: 'DENOMINATION',
} as const;
export type CashControlCountMode =
  (typeof CASH_CONTROL_COUNT_MODE)[keyof typeof CASH_CONTROL_COUNT_MODE];

/** How a physical count is entered: one total, or note-by-note. */
export type CashCountMethod = 'TOTAL_ONLY' | 'DENOMINATION';

/**
 * The count methods a count policy permits. `TOTAL_ONLY` and `DENOMINATION` are mandatory
 * choices; `OPTIONAL_DENOMINATION` lets the counter pick. Pure — shared by the server check and the
 * UI so what the form offers is exactly what the server accepts.
 *
 * @param mode the resolved opening or closing count mode
 * @returns the allowed methods, default first
 * @example allowedCountMethods('DENOMINATION') // ['DENOMINATION']
 */
export function allowedCountMethods(mode: CashControlCountMode): CashCountMethod[] {
  if (mode === CASH_CONTROL_COUNT_MODE.DENOMINATION) return ['DENOMINATION'];
  if (mode === CASH_CONTROL_COUNT_MODE.TOTAL_ONLY) return ['TOTAL_ONLY'];
  return ['TOTAL_ONLY', 'DENOMINATION'];
}

/** D16 — who absorbs the un-tenderable fraction of cash change. */
export const CASH_CONTROL_CHANGE_BEARER = {
  BUSINESS: 'BUSINESS',
  CUSTOMER: 'CUSTOMER',
  NEAREST: 'NEAREST',
} as const;
export type CashControlChangeBearer =
  (typeof CASH_CONTROL_CHANGE_BEARER)[keyof typeof CASH_CONTROL_CHANGE_BEARER];

export const CASH_CONTROL_ASSIGNMENT_MODE = {
  OPEN: 'OPEN',
  ASSIGNED_ONLY: 'ASSIGNED_ONLY',
} as const;
export type CashControlAssignmentMode =
  (typeof CASH_CONTROL_ASSIGNMENT_MODE)[keyof typeof CASH_CONTROL_ASSIGNMENT_MODE];

export const CASH_CONTROL_SHARED_SESSION_MODE = {
  SHARED: 'SHARED',
  EXCLUSIVE: 'EXCLUSIVE',
} as const;
export type CashControlSharedSessionMode =
  (typeof CASH_CONTROL_SHARED_SESSION_MODE)[keyof typeof CASH_CONTROL_SHARED_SESSION_MODE];

export const CASH_CONTROL_MAX_CASH_ENFORCE_MODE = {
  OFF: 'OFF',
  WARN: 'WARN',
  BLOCK: 'BLOCK',
} as const;
export type CashControlMaxCashEnforceMode =
  (typeof CASH_CONTROL_MAX_CASH_ENFORCE_MODE)[keyof typeof CASH_CONTROL_MAX_CASH_ENFORCE_MODE];

export const CASH_CONTROL_ROLLOVER_MODE = {
  OFF: 'OFF',
  PAUSE_AT_ROLLOVER: 'PAUSE_AT_ROLLOVER',
  FORCE_CLOSE_AT_ROLLOVER: 'FORCE_CLOSE_AT_ROLLOVER',
} as const;
export type CashControlRolloverMode =
  (typeof CASH_CONTROL_ROLLOVER_MODE)[keyof typeof CASH_CONTROL_ROLLOVER_MODE];

// ========================
// Resolved settings shape
// ========================

/**
 * Always fully populated — every field is non-optional (§3.1.3 rule 2). No
 * caller branches on `undefined`; a `NULL` at every scope resolves to the
 * `default` below, never to `undefined`.
 */
export interface CashControlSettings {
  blindCloseEnabled: boolean;
  varianceGateMode: CashControlVarianceGateMode;
  /** Approval band. `null` = no threshold configured at any scope. */
  varianceThresholdAmount: number | null;
  /** Reason-required band, below the approval band. */
  varianceReasonAmount: number | null;
  /** Auto-accept band, below the reason band. */
  varianceToleranceAmount: number | null;
  cashTrackingMode: CashControlTrackingMode;
  openingCountMode: CashControlCountMode;
  closingCountMode: CashControlCountMode;
  cashChangeBearer: CashControlChangeBearer;
  /** `null` = inherit the HQ CASH_CHANGE rounding_increment_minor. */
  cashChangeRoundToMinor: number | null;
  drawerAssignmentMode: CashControlAssignmentMode;
  sharedSessionMode: CashControlSharedSessionMode;
  maxCashEnforceMode: CashControlMaxCashEnforceMode;
  cashDropRequiresDest: boolean;
  /** POS-session requirement per finance screen (0554); see POS_SESSION_SURFACE. */
  posSessionModeOrderEntry: PosSessionRequirementMode;
  posSessionModeLaterColl: PosSessionRequirementMode;
  posSessionModeStoredVal: PosSessionRequirementMode;
  posSessionModeCashRefd: PosSessionRequirementMode;
  posSessionModeCustRcpt: PosSessionRequirementMode;
  posSessionModeManualVchr: PosSessionRequirementMode;
  posSessionRolloverMode: CashControlRolloverMode;
  posSessionStaleHours: number;
  shiftZReportRequired: boolean;
  /** CLF (0528): interactive cash needs an open session. Falls back to the drawer type default. */
  requiresSession: boolean;
  /** CLF (0528): a count is required when a session opens. Falls back to the drawer type default. */
  openingCountRequired: boolean;
  /** CLF (0528): a count is required at the close count step. Falls back to the drawer type default. */
  closingCountRequired: boolean;
}

/**
 * Where a resolved value came from — shown on the drawer Policy tab so the user
 * sees what is inherited and what is overridden.
 */
export const CASH_CONTROL_VALUE_SOURCE = {
  DRAWER: 'DRAWER',
  USER: 'USER',
  BRANCH: 'BRANCH',
  TENANT: 'TENANT',
  TYPE_DEFAULT: 'TYPE_DEFAULT',
  DEFAULT: 'DEFAULT',
} as const;
export type CashControlValueSource = (typeof CASH_CONTROL_VALUE_SOURCE)[keyof typeof CASH_CONTROL_VALUE_SOURCE];

/** sys_cash_drawer_type_cd default columns usable as a resolution layer. */
export type DrawerTypeDefaultColumn =
  | 'requires_session_default'
  | 'opening_count_required_default'
  | 'closing_count_required_default';

// ========================
// Setting definitions registry
// ========================

type CashControlSettingType = 'boolean' | 'enum' | 'number';

interface CashControlSettingDefBase {
  /** org_fin_cash_ctrl_stng_cf column name — DB-mirrored. */
  dbColumn: string;
  /** CashControlSettings field name. */
  tsField: keyof CashControlSettings;
  /** i18n key stem: cashControl.settings.<i18nKey>.{label,description}. */
  i18nKey: string;
}

interface CashControlBooleanSettingDef extends CashControlSettingDefBase {
  type: 'boolean';
  default: boolean;
  /** CLF: when no scope sets a value and a drawer is known, use this drawer-type default before `default`. */
  typeDefaultColumn?: DrawerTypeDefaultColumn;
}

interface CashControlEnumSettingDef extends CashControlSettingDefBase {
  type: 'enum';
  values: readonly string[];
  default: string;
}

interface CashControlNumberSettingDef extends CashControlSettingDefBase {
  type: 'number';
  default: number | null;
  /** Inclusive lower bound. `variance*Amount` fields allow >= 0. */
  min?: number;
  /** Exclusive lower bound used where the DB CHECK is a strict `> 0`. */
  exclusiveMin?: number;
}

export type CashControlSettingDef =
  | CashControlBooleanSettingDef
  | CashControlEnumSettingDef
  | CashControlNumberSettingDef;

/**
 * One entry per `org_fin_cash_ctrl_stng_cf` setting column (§3.1.4). Order
 * matches the migration and the plan table. The resolver's `loadOverrides`
 * and `updateCashControlSettings` iterate this list rather than hardcoding
 * field names a second time.
 */
export const CASH_CONTROL_SETTING_DEFS: readonly CashControlSettingDef[] = [
  {
    dbColumn: 'blind_close_enabled',
    tsField: 'blindCloseEnabled',
    type: 'boolean',
    default: false,
    i18nKey: 'blindCloseEnabled',
  },
  {
    dbColumn: 'variance_gate_mode',
    tsField: 'varianceGateMode',
    type: 'enum',
    values: Object.values(CASH_CONTROL_VARIANCE_GATE_MODE),
    default: CASH_CONTROL_VARIANCE_GATE_MODE.WARN_ONLY,
    i18nKey: 'varianceGateMode',
  },
  {
    dbColumn: 'variance_threshold_amount',
    tsField: 'varianceThresholdAmount',
    type: 'number',
    default: null,
    min: 0,
    i18nKey: 'varianceThresholdAmount',
  },
  {
    dbColumn: 'variance_reason_amount',
    tsField: 'varianceReasonAmount',
    type: 'number',
    default: null,
    min: 0,
    i18nKey: 'varianceReasonAmount',
  },
  {
    dbColumn: 'variance_tolerance_amount',
    tsField: 'varianceToleranceAmount',
    type: 'number',
    default: null,
    min: 0,
    i18nKey: 'varianceToleranceAmount',
  },
  {
    dbColumn: 'cash_tracking_mode',
    tsField: 'cashTrackingMode',
    type: 'enum',
    values: Object.values(CASH_CONTROL_TRACKING_MODE),
    default: CASH_CONTROL_TRACKING_MODE.COUNT_BY_DENOMINATION,
    i18nKey: 'cashTrackingMode',
  },
  {
    dbColumn: 'opening_count_mode',
    tsField: 'openingCountMode',
    type: 'enum',
    values: Object.values(CASH_CONTROL_COUNT_MODE),
    default: CASH_CONTROL_COUNT_MODE.OPTIONAL_DENOMINATION,
    i18nKey: 'openingCountMode',
  },
  {
    dbColumn: 'closing_count_mode',
    tsField: 'closingCountMode',
    type: 'enum',
    values: Object.values(CASH_CONTROL_COUNT_MODE),
    default: CASH_CONTROL_COUNT_MODE.DENOMINATION,
    i18nKey: 'closingCountMode',
  },
  {
    dbColumn: 'cash_change_bearer',
    tsField: 'cashChangeBearer',
    type: 'enum',
    values: Object.values(CASH_CONTROL_CHANGE_BEARER),
    default: CASH_CONTROL_CHANGE_BEARER.BUSINESS,
    i18nKey: 'cashChangeBearer',
  },
  {
    dbColumn: 'cash_change_round_to_minor',
    tsField: 'cashChangeRoundToMinor',
    type: 'number',
    default: null,
    exclusiveMin: 0,
    i18nKey: 'cashChangeRoundToMinor',
  },
  {
    dbColumn: 'drawer_assignment_mode',
    tsField: 'drawerAssignmentMode',
    type: 'enum',
    values: Object.values(CASH_CONTROL_ASSIGNMENT_MODE),
    default: CASH_CONTROL_ASSIGNMENT_MODE.OPEN,
    i18nKey: 'drawerAssignmentMode',
  },
  {
    dbColumn: 'shared_session_mode',
    tsField: 'sharedSessionMode',
    type: 'enum',
    values: Object.values(CASH_CONTROL_SHARED_SESSION_MODE),
    default: CASH_CONTROL_SHARED_SESSION_MODE.SHARED,
    i18nKey: 'sharedSessionMode',
  },
  {
    dbColumn: 'max_cash_enforce_mode',
    tsField: 'maxCashEnforceMode',
    type: 'enum',
    values: Object.values(CASH_CONTROL_MAX_CASH_ENFORCE_MODE),
    default: CASH_CONTROL_MAX_CASH_ENFORCE_MODE.WARN,
    i18nKey: 'maxCashEnforceMode',
  },
  {
    dbColumn: 'cash_drop_requires_dest',
    tsField: 'cashDropRequiresDest',
    type: 'boolean',
    default: true,
    i18nKey: 'cashDropRequiresDest',
  },
  {
    dbColumn: 'pos_session_mode_order_entry',
    tsField: 'posSessionModeOrderEntry',
    type: 'enum',
    values: Object.values(POS_SESSION_REQUIREMENT_MODE),
    default: POS_SESSION_REQUIREMENT_MODE.REQUIRED_FOR_CASH,
    i18nKey: 'posSessionModeOrderEntry',
  },
  {
    dbColumn: 'pos_session_mode_later_coll',
    tsField: 'posSessionModeLaterColl',
    type: 'enum',
    values: Object.values(POS_SESSION_REQUIREMENT_MODE),
    default: POS_SESSION_REQUIREMENT_MODE.OPTIONAL,
    i18nKey: 'posSessionModeLaterColl',
  },
  {
    dbColumn: 'pos_session_mode_stored_val',
    tsField: 'posSessionModeStoredVal',
    type: 'enum',
    values: Object.values(POS_SESSION_REQUIREMENT_MODE),
    default: POS_SESSION_REQUIREMENT_MODE.OPTIONAL,
    i18nKey: 'posSessionModeStoredVal',
  },
  {
    dbColumn: 'pos_session_mode_cash_refd',
    tsField: 'posSessionModeCashRefd',
    type: 'enum',
    values: Object.values(POS_SESSION_REQUIREMENT_MODE),
    default: POS_SESSION_REQUIREMENT_MODE.OPTIONAL,
    i18nKey: 'posSessionModeCashRefd',
  },
  {
    dbColumn: 'pos_session_mode_cust_rcpt',
    tsField: 'posSessionModeCustRcpt',
    type: 'enum',
    values: Object.values(POS_SESSION_REQUIREMENT_MODE),
    default: POS_SESSION_REQUIREMENT_MODE.OPTIONAL,
    i18nKey: 'posSessionModeCustRcpt',
  },
  {
    dbColumn: 'pos_session_mode_manual_vchr',
    tsField: 'posSessionModeManualVchr',
    type: 'enum',
    values: Object.values(POS_SESSION_REQUIREMENT_MODE),
    default: POS_SESSION_REQUIREMENT_MODE.OPTIONAL,
    i18nKey: 'posSessionModeManualVchr',
  },
  {
    dbColumn: 'pos_session_rollover_mode',
    tsField: 'posSessionRolloverMode',
    type: 'enum',
    values: Object.values(CASH_CONTROL_ROLLOVER_MODE),
    default: CASH_CONTROL_ROLLOVER_MODE.PAUSE_AT_ROLLOVER,
    i18nKey: 'posSessionRolloverMode',
  },
  {
    dbColumn: 'pos_session_stale_hours',
    tsField: 'posSessionStaleHours',
    type: 'number',
    default: 12,
    exclusiveMin: 0,
    i18nKey: 'posSessionStaleHours',
  },
  {
    dbColumn: 'shift_z_report_required',
    tsField: 'shiftZReportRequired',
    type: 'boolean',
    default: true,
    i18nKey: 'shiftZReportRequired',
  },
  {
    dbColumn: 'requires_session',
    tsField: 'requiresSession',
    type: 'boolean',
    default: true,
    typeDefaultColumn: 'requires_session_default',
    i18nKey: 'requiresSession',
  },
  {
    dbColumn: 'opening_count_required',
    tsField: 'openingCountRequired',
    type: 'boolean',
    default: false,
    typeDefaultColumn: 'opening_count_required_default',
    i18nKey: 'openingCountRequired',
  },
  {
    dbColumn: 'closing_count_required',
    tsField: 'closingCountRequired',
    type: 'boolean',
    default: false,
    typeDefaultColumn: 'closing_count_required_default',
    i18nKey: 'closingCountRequired',
  },
] as const;

/** Which setting holds the POS-session requirement of each finance surface. */
export const POS_SESSION_SURFACE_SETTING_FIELD = {
  [POS_SESSION_SURFACE.ORDER_ENTRY]: 'posSessionModeOrderEntry',
  [POS_SESSION_SURFACE.LATER_COLLECTION]: 'posSessionModeLaterColl',
  [POS_SESSION_SURFACE.STORED_VALUE_SALE]: 'posSessionModeStoredVal',
  [POS_SESSION_SURFACE.CASH_REFUND]: 'posSessionModeCashRefd',
  [POS_SESSION_SURFACE.CUSTOMER_RECEIPT]: 'posSessionModeCustRcpt',
  [POS_SESSION_SURFACE.MANUAL_VOUCHER]: 'posSessionModeManualVchr',
} as const satisfies Record<PosSessionSurface, keyof CashControlSettings>;

/**
 * Fully-defaulted settings object. Returned by the resolver when no scope in
 * the chain has any override (a brand-new tenant is fully configured by this
 * alone — §10.12, §3.1.2).
 */
export const CASH_CONTROL_SETTINGS_DEFAULT: CashControlSettings =
  CASH_CONTROL_SETTING_DEFS.reduce((acc, def) => {
    (acc as unknown as Record<string, unknown>)[def.tsField] = def.default;
    return acc;
  }, {} as CashControlSettings);

// Permission codes (`cash_control:view` / `cash_control:manage`) are NOT
// redefined here — the single source is `FINANCE_PERMISSIONS` in
// lib/constants/permissions/finance-perm.ts (migration 0517), per CLAUDE.md's
// "one concept in one place" rule. Import from there.
