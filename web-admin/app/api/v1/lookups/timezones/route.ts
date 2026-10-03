/**
 * GET /api/v1/lookups/timezones
 * Active sys_timezone_cd rows (auth-only, read-only HQ catalog) for timezone pickers.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db/prisma';

/**
 * List active IANA timezones, ordered for a picker (region, then offset).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await prisma.sys_timezone_cd.findMany({
      where: { is_active: true, rec_status: 1 },
      select: {
        code: true,
        name: true,
        name2: true,
        region: true,
        utc_offset_string: true,
      },
      orderBy: [{ region: 'asc' }, { utc_offset_hours: 'asc' }, { display_order: 'asc' }],
    });

    return NextResponse.json({ success: true, data: rows });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load timezones' }, { status: 500 });
  }
}
