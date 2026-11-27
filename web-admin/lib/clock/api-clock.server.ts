import 'server-only';

/**
 * S6 API helpers (D9, D21, D34; MASTER_PLAN_v2 §5.4, §6.3):
 * - `screenClock` adds the `clock` block to a screen endpoint response;
 * - `clockErrorResponse` turns a clock error into its HTTP status and code;
 * - `resolveZonedInput` turns a typed `{ date, time, disambiguation?, zone? }` into an instant,
 *   with `409 ZONE_MISMATCH` when the client's zone echo differs from the server's zone.
 */
import { NextResponse } from 'next/server';
import {
  ClockError,
  dtAtLocal,
  isClockError,
  type ClockBlock,
  type Instant,
  type OperationalZoneOperation,
  type PublicClockBlock,
} from '@cmx/clock';
import type { ZonedInput } from '@cmx/clock/zod';
import { getPublicClockBlock, getScreenClockBlock } from '@/lib/clock/clock-block.server';
import { logger } from '@/lib/utils/logger';

export interface ScreenClockOptions {
  operation?: OperationalZoneOperation;
  branchId?: string | null;
}

/**
 * The `clock` block for a screen endpoint (`technical_docs/api-clock-inventory.md`). A failure
 * to build it never fails the screen: it is logged and the block is null (the screen then shows
 * no clock, fail closed).
 */
export async function screenClock(tenantOrgId: string, options: ScreenClockOptions = {}): Promise<ClockBlock | null> {
  try {
    return await getScreenClockBlock({
      tenantOrgId,
      operation: options.operation ?? 'accept_order',
      branchId: options.branchId ?? null,
    });
  } catch (error) {
    logger.warn('clock block unavailable', { feature: 'clock', tenantId: tenantOrgId, error: String(error) });
    return null;
  }
}

/** The public subset (zone, serverNow, hourCycle, dateFormat) for anon endpoints (§7.16). */
export async function publicScreenClock(
  tenantOrgId: string,
  options: ScreenClockOptions = {},
): Promise<PublicClockBlock | null> {
  try {
    return await getPublicClockBlock({
      tenantOrgId,
      operation: options.operation ?? 'accept_order',
      branchId: options.branchId ?? null,
    });
  } catch (error) {
    logger.warn('public clock block unavailable', { feature: 'clock', tenantId: tenantOrgId, error: String(error) });
    return null;
  }
}

/** Body of a clock error response. `messageKey` is the `clock.errors.*` key (null: not shown). */
export interface ClockErrorBody {
  success: false;
  error: string;
  code: string;
  messageKey: string | null;
  details?: Record<string, unknown>;
}

/**
 * The response for a clock error (`ZONE_MISMATCH` 409, `LOCAL_TIME_*` 422, parse errors 400, …),
 * or null when the error is not a clock error (the caller keeps its own handling).
 * Internal codes (`CLOCK_UNKNOWN_OPERATION`, `OPS_ZONE_TENANT_MISMATCH`) carry no details.
 */
export function clockErrorResponse(error: unknown): NextResponse<ClockErrorBody> | null {
  if (!isClockError(error)) return null;
  const shown = error.messageKey !== null;
  return NextResponse.json<ClockErrorBody>(
    {
      success: false,
      error: error.code,
      code: error.code,
      messageKey: error.messageKey,
      ...(shown ? { details: { ...error.details } } : {}),
    },
    { status: error.httpStatus },
  );
}

/**
 * D9: a client zone is an echo. When the client sent one and it is not the server's zone, the
 * page is stale: `ZONE_MISMATCH` (409). No zone on the server: `TIMEZONE_NOT_CONFIGURED`.
 */
export function assertZoneEcho(clientZone: string | null | undefined, serverZone: string | null | undefined): string {
  if (!serverZone) throw new ClockError('TIMEZONE_NOT_CONFIGURED');
  if (clientZone && clientZone !== serverZone) {
    throw new ClockError('ZONE_MISMATCH', { clientZone, serverZone });
  }
  return serverZone;
}

/**
 * A typed local date and time at the shop to an instant. `disambiguation` defaults to `reject`
 * (typed input): a time in a DST gap is `LOCAL_TIME_NONEXISTENT`, one in an overlap is
 * `LOCAL_TIME_AMBIGUOUS`; the screen then asks earlier or later (`CmxDstChoice`).
 */
export function resolveZonedInput(input: ZonedInput, serverZone: string | null | undefined): Instant {
  const zone = assertZoneEcho(input.zone, serverZone);
  return dtAtLocal(input.date, input.time, zone, input.disambiguation ?? 'reject');
}
