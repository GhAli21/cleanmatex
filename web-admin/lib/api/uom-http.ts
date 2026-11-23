/**
 * Shared HTTP plumbing for the /api/v1/uom routes: a body guard and the mapping of
 * UoM rule errors to `{ success:false, error:{ code, messageKey } }` (messageKey = `uom.errors.<CODE>`).
 */
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { UOM_ERROR_CODES } from '@/lib/constants/uom';
import { UomRuleError } from '@/lib/uom';
import { log } from '@/lib/utils/logger';

const STATUS: Partial<Record<string, number>> = {
  [UOM_ERROR_CODES.UOM_NOT_FOUND]: 404,
  [UOM_ERROR_CODES.UOM_IN_USE]: 409,
  [UOM_ERROR_CODES.UOM_CODE_RESERVED]: 409,
};

/** Parses a JSON body with a schema; returns the data or a 400 response. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<{ data: T } | { response: NextResponse }> {
  let json: unknown;
  try { json = await request.json(); } catch { json = null; }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      response: NextResponse.json(
        { success: false, error: { code: 'VALIDATION', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data };
}

/** Maps a thrown error to a response (rule errors 4xx, anything else 500 and logged). */
export function uomErrorResponse(error: unknown, action: string): NextResponse {
  if (error instanceof UomRuleError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, messageKey: `uom.errors.${error.code}`, details: error.details } },
      { status: STATUS[error.code] ?? 422, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  log.error(`[API] uom ${action}`, error instanceof Error ? error : new Error(String(error)), { feature: 'uom', action });
  return NextResponse.json({ success: false, error: { code: 'INTERNAL' } }, { status: 500 });
}
