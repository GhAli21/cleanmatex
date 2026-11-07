/**
 * Setup Health codes. Values mirror the database exactly (DB-mirror rule):
 * severities = CHECK chk_shc_severity on sys_setup_health_check_cd; statuses =
 * what fn_setup_health_run returns (0709). Check and domain codes are data
 * (sys_setup_health_*_cd), so they are not constants here.
 */
export const SETUP_HEALTH_SEVERITY = {
  BLOCKER: 'BLOCKER',
  WARNING: 'WARNING',
  INFO: 'INFO',
} as const

export type SetupHealthSeverity = (typeof SETUP_HEALTH_SEVERITY)[keyof typeof SETUP_HEALTH_SEVERITY]

export const SETUP_HEALTH_STATUS = {
  OK: 'OK',
  FAIL: 'FAIL',
  NA: 'NA',
  ERROR: 'ERROR',
} as const

export type SetupHealthStatus = (typeof SETUP_HEALTH_STATUS)[keyof typeof SETUP_HEALTH_STATUS]
