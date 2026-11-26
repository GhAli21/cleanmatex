import { ClockError } from './errors.js';
import { isOperationalZoneOperation, type OperationalZoneOperation } from './operations.js';
import type { ZoneId } from './types.js';

export interface ZoneCandidates {
  operation: string;
  /** Zone of the feature scope (usually the owning branch), if any. */
  scopeZone: string | null | undefined;
  /** `org_tenants_mst.timezone`. */
  organizationZone: string | null | undefined;
  /** True when the code is an active catalog zone (`sys_timezone_cd.is_active`). */
  isActiveZone: (zone: string) => boolean;
}

/**
 * The pure zone rule shared by the three doors (§1.2 rule 3): the scope zone when it is active,
 * otherwise the organization zone when it is active, otherwise null (fail closed). An unknown
 * operation raises `CLOCK_UNKNOWN_OPERATION` (mirror of `fn_cmx_dt_zone`). The caller picks the
 * scope per operation (`notify` and `delivery` may pass different branches).
 */
export function selectZoneFromCandidates(input: ZoneCandidates): ZoneId | null {
  if (!isOperationalZoneOperation(input.operation)) {
    throw new ClockError('CLOCK_UNKNOWN_OPERATION', { operation: input.operation });
  }
  if (input.scopeZone && input.isActiveZone(input.scopeZone)) return input.scopeZone as ZoneId;
  if (input.organizationZone && input.isActiveZone(input.organizationZone)) return input.organizationZone as ZoneId;
  return null;
}

/** Like {@link selectZoneFromCandidates} but raises `TIMEZONE_NOT_CONFIGURED` instead of null (`fn_cmx_dt_zone_required`). */
export function requireZoneFromCandidates(input: ZoneCandidates): ZoneId {
  const zone = selectZoneFromCandidates(input);
  if (!zone) throw new ClockError('TIMEZONE_NOT_CONFIGURED', { operation: input.operation as OperationalZoneOperation });
  return zone;
}
