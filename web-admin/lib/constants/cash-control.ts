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
  posSessionReqForCash: boolean;
  posSessionReqAllTenders: boolean;
  posSessionRolloverMode: CashControlRolloverMode;
  posSessionStaleHours: number;
  shiftZReportRequired: boolean;
}

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
    dbColumn: 'pos_session_req_for_cash',
    tsField: 'posSessionReqForCash',
    type: 'boolean',
    default: true,
    i18nKey: 'posSessionReqForCash',
  },
  {
    dbColumn: 'pos_session_req_all_tenders',
    tsField: 'posSessionReqAllTenders',
    type: 'boolean',
    default: false,
    i18nKey: 'posSessionReqAllTenders',
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
] as const;

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
