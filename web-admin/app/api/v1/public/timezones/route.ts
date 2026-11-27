/**
 * GET /api/v1/public/timezones
 * Active time zones for the public registration picker (G2). Read-only reference data
 * (IANA names), served by the server; the catalog table itself stays closed to anon.
 */

import { NextResponse } from 'next/server';
import { listActiveTimeZones } from '@/lib/services/timezone-catalog.service';
import { logger } from '@/lib/utils/logger';

/** List active canonical IANA zones. */
export async function GET() {
  try {
    const data = await listActiveTimeZones();
    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
    );
  } catch (err) {
    logger.error('GET /public/timezones failed', err instanceof Error ? err : new Error(String(err)), {});
    return NextResponse.json({ success: false, error: 'Failed to load timezones' }, { status: 500 });
  }
}
