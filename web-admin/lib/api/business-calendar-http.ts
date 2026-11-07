import 'server-only';

import { NextResponse } from 'next/server';

import { BusinessCalendarError } from '@/lib/services/settings/business-calendar.service';
import { logger } from '@/lib/utils/logger';

/**
 * Business Calendar route responses: `{ success, data }` or
 * `{ success: false, error: { code, messageKey } }`, never an internal message.
 * The screen translates `messageKey` (`settings.calendar.errors.<code>`).
 */
export const calendarOk = <T>(data: T, status = 200) =>
  NextResponse.json({ success: true, data }, { status, headers: { 'Cache-Control': 'no-store' } });

/** Error envelope with a stable code. */
export const calendarError = (status: number, code: string) =>
  NextResponse.json(
    { success: false, error: { code, messageKey: `settings.calendar.errors.${code}` } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );

/**
 * Maps a thrown error: a `BusinessCalendarError` keeps its code and status; anything else is logged and becomes 500.
 * @param error - the caught error
 * @param context - log context (tenant, action)
 */
export function calendarFailure(error: unknown, context: Record<string, unknown>): NextResponse {
  if (error instanceof BusinessCalendarError) return calendarError(error.status, error.code);
  logger.error('Business calendar request failed', error instanceof Error ? error : new Error('Unknown calendar error'), {
    feature: 'business_calendar', ...context,
  });
  return calendarError(500, 'INTERNAL_ERROR');
}
