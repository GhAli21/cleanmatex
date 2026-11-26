import { ClockError } from './errors.js';

/**
 * Closed operation codes (MASTER_PLAN_v2 §1.2 rule 5, D27). The caller names which branch owns
 * the action. Any area that needs its own zone rule gets its own code: a migration (the allowed
 * list in `fn_ops_zone` / `fn_cmx_dt_zone`), a change here, and a vector.
 */
export const OPERATIONAL_ZONE_OPERATIONS = [
  'accept_order',
  'ready_by',
  'pos_session',
  'delivery',
  'invoice',
  'ledger',
  'notify',
] as const;

export type OperationalZoneOperation = (typeof OPERATIONAL_ZONE_OPERATIONS)[number];

/**
 * Codes the database door (`fn_ops_zone` / `fn_cmx_dt_zone`) accepts. `notify` was added to the
 * SQL list by migration `0842_cmx_dt_clock_api.sql` (slice S2) and here in the same change, so the
 * list equals `fn_cmx_dt_operations()`. Deploy this code only to a database where `0842` is
 * applied: the `0830` door returns null for `notify` (caller sees `TIMEZONE_NOT_CONFIGURED`).
 */
export const SQL_DOOR_OPERATIONS: readonly OperationalZoneOperation[] = [
  'accept_order',
  'ready_by',
  'pos_session',
  'delivery',
  'invoice',
  'ledger',
  'notify',
];

export function isOperationalZoneOperation(value: string): value is OperationalZoneOperation {
  return (OPERATIONAL_ZONE_OPERATIONS as readonly string[]).includes(value);
}

/** True when the deployed SQL door accepts the code (see {@link SQL_DOOR_OPERATIONS}). */
export function isSqlDoorOperation(value: string): value is OperationalZoneOperation {
  return (SQL_DOOR_OPERATIONS as readonly string[]).includes(value);
}

/**
 * Throws `CLOCK_UNKNOWN_OPERATION` unless the code may be sent to the database door today.
 * Call it before any RPC to `fn_ops_zone` / `fn_cmx_dt_zone`.
 */
export function assertSqlDoorOperation(value: string): OperationalZoneOperation {
  if (!isOperationalZoneOperation(value)) {
    throw new ClockError('CLOCK_UNKNOWN_OPERATION', { operation: value });
  }
  if (!isSqlDoorOperation(value)) {
    throw new ClockError('CLOCK_UNKNOWN_OPERATION', {
      operation: value,
      reason: 'not accepted by the SQL door (fn_cmx_dt_operations)',
    });
  }
  return value;
}
