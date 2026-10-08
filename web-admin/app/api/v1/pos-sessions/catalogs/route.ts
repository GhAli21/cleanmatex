import { NextRequest, NextResponse } from 'next/server';
import { requireAnyPermission } from '@/lib/middleware/require-permission';
import { getSessionLifecycleCatalogs } from '@/lib/services/session-lifecycle-catalogs.service';
import { logger } from '@/lib/utils/logger';
import { posSessionResponse } from '../_response';

/**
 * GET /api/v1/pos-sessions/catalogs
 *
 * Bilingual labels for the POS-session statuses, POS-session event types and cash-drawer-session
 * statuses (global `sys_*` catalogs, no tenant scoping). Every screen that shows a session status
 * or an audit event resolves its label from here instead of printing the raw code.
 *
 * Open to anyone who can view POS sessions or cash drawers: both screens display these lifecycle
 * codes, and the payload carries names only — no tenant data.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAnyPermission(['pos_session:view', 'cash_drawer:view'])(request);
  if (auth instanceof NextResponse) return auth;

  try {
    return posSessionResponse(await getSessionLifecycleCatalogs());
  } catch (error) {
    logger.error('Failed to load session lifecycle catalogs', error as Error);
    return NextResponse.json({ success: false, error: 'Failed to load session catalogs' }, { status: 500 });
  }
}
