/**
 * The clock error vocabulary (MASTER_PLAN_v2 §5.4). The same codes are raised by SQL
 * (`fn_cmx_dt_*`), TypeScript, the API and Dart.
 */
export const CLOCK_ERROR_CODES = [
  'TIMEZONE_NOT_CONFIGURED',
  'LOCAL_TIME_NONEXISTENT',
  'LOCAL_TIME_AMBIGUOUS',
  'INSTANT_OFFSET_REQUIRED',
  'INVALID_CIVIL_DATE',
  'INVALID_LOCAL_TIME',
  'ZONE_MISMATCH',
  'INVALID_TIME_ZONE',
  'OPS_ZONE_TENANT_MISMATCH',
  'CLOCK_SETTING_INVALID',
  'CLOCK_UNKNOWN_OPERATION',
  'ZONE_CHANGE_BLOCKED_OPEN_SESSION',
] as const;

export type ClockErrorCode = (typeof CLOCK_ERROR_CODES)[number];

/** HTTP status per code (§5.4). */
export const CLOCK_ERROR_HTTP_STATUS: Readonly<Record<ClockErrorCode, number>> = {
  TIMEZONE_NOT_CONFIGURED: 422,
  LOCAL_TIME_NONEXISTENT: 422,
  LOCAL_TIME_AMBIGUOUS: 422,
  INSTANT_OFFSET_REQUIRED: 400,
  INVALID_CIVIL_DATE: 400,
  INVALID_LOCAL_TIME: 400,
  ZONE_MISMATCH: 409,
  INVALID_TIME_ZONE: 400,
  OPS_ZONE_TENANT_MISMATCH: 403,
  CLOCK_SETTING_INVALID: 400,
  CLOCK_UNKNOWN_OPERATION: 500,
  ZONE_CHANGE_BLOCKED_OPEN_SESSION: 409,
};

/**
 * i18n key per code in the `clock` namespace (`web-admin/messages/{en,ar}/clock.json`).
 * `null` means the code is never shown to a user (generic error / generic forbidden).
 */
export const CLOCK_ERROR_MESSAGE_KEYS: Readonly<Record<ClockErrorCode, string | null>> = {
  TIMEZONE_NOT_CONFIGURED: 'clock.errors.timezoneNotConfigured',
  LOCAL_TIME_NONEXISTENT: 'clock.errors.localTimeNonexistent',
  LOCAL_TIME_AMBIGUOUS: 'clock.errors.localTimeAmbiguous',
  INSTANT_OFFSET_REQUIRED: 'clock.errors.instantOffsetRequired',
  INVALID_CIVIL_DATE: 'clock.errors.invalidCivilDate',
  INVALID_LOCAL_TIME: 'clock.errors.invalidLocalTime',
  ZONE_MISMATCH: 'clock.errors.zoneMismatch',
  INVALID_TIME_ZONE: 'clock.errors.invalidTimeZone',
  OPS_ZONE_TENANT_MISMATCH: null,
  CLOCK_SETTING_INVALID: 'clock.errors.settingInvalid',
  CLOCK_UNKNOWN_OPERATION: null,
  ZONE_CHANGE_BLOCKED_OPEN_SESSION: 'clock.errors.zoneChangeBlockedOpenSession',
};

/** A clock rule was broken. `code` is stable; `message` equals `code` so logs stay greppable. */
export class ClockError extends Error {
  readonly code: ClockErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: ClockErrorCode, details: Record<string, unknown> = {}) {
    super(code);
    this.name = 'ClockError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }

  /** HTTP status for an API response. */
  get httpStatus(): number {
    return CLOCK_ERROR_HTTP_STATUS[this.code];
  }

  /** i18n key, or null when the code must not be shown to a user. */
  get messageKey(): string | null {
    return CLOCK_ERROR_MESSAGE_KEYS[this.code];
  }
}

/** True for a {@link ClockError}, also across bundle copies (checks the shape, not the prototype). */
export function isClockError(value: unknown): value is ClockError {
  return (
    value instanceof ClockError ||
    (typeof value === 'object' &&
      value !== null &&
      (value as { name?: unknown }).name === 'ClockError' &&
      (CLOCK_ERROR_CODES as readonly string[]).includes((value as { code?: string }).code ?? ''))
  );
}
