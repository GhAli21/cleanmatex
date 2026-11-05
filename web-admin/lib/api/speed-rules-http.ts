import 'server-only';

import { NextResponse } from 'next/server';

import { SpeedRuleError } from '@/lib/services/catalog/speed-rules.service';
import { logger } from '@/lib/utils/logger';

/**
 * Speed Pricing route responses: `{ success, data }` or
 * `{ success: false, error: { code } }`, never an internal message. The screen
 * translates the code (`catalog.speedPricing.errors.<code>`).
 */
export const speedRulesOk = <T>(data: T, status = 200) =>
  NextResponse.json({ success: true, data }, { status, headers: { 'Cache-Control': 'no-store' } });

/** Error envelope with a stable code. */
export const speedRulesError = (status: number, code: string) =>
  NextResponse.json({ success: false, error: { code } }, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * Maps a thrown error: a `SpeedRuleError` keeps its code and status; anything else is logged and becomes 500.
 * @param error - the caught error
 * @param context - log context (tenant, action)
 */
export function speedRulesFailure(error: unknown, context: Record<string, unknown>): NextResponse {
  if (error instanceof SpeedRuleError) return speedRulesError(error.status, error.code);
  logger.error('Speed rules request failed', error instanceof Error ? error : new Error('Unknown speed rules error'), { feature: 'speed_pricing', ...context });
  return speedRulesError(500, 'INTERNAL_ERROR');
}
