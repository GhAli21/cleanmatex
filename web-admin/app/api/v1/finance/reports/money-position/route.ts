import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { logger } from '@/lib/utils/logger';
import { getMoneyPosition } from '@/lib/services/reports/finance-money-position.service';

/**
 * GET /api/v1/finance/reports/money-position
 *
 * Owner/finance glance: today's canonical order-payment collections by method,
 * orders + AR outstanding, stored-value liability, and open drawer sessions.
 * Point-in-time — no query params.
 *
 * @param request authenticated request (`finance_reports:view`)
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('finance_reports:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const data = await getMoneyPosition(tenantId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error(
      'money-position report failed',
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'finance-reports', tenantId },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load money position' },
      { status: 500 },
    );
  }
}
