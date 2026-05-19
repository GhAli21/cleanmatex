/**
 * Cash Drawer Detail Page
 *
 * Shows a single drawer's current session status, movements, and session history.
 * Route: /dashboard/internal_fin/cash-drawers/[drawerId]
 */

import { notFound } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { Decimal } from '@prisma/client/runtime/library';
import CashDrawerDetailClient from '@features/billing/ui/cash-drawer-detail-client';

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

interface PageProps {
  params: Promise<{ drawerId: string }>;
}

export default async function CashDrawerDetailPage({ params }: PageProps) {
  const { drawerId } = await params;

  let tenantId: string;
  try {
    const auth = await getAuthContext();
    tenantId = auth.tenantId;
  } catch (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error instanceof Error ? error.message : 'Authentication failed. Please log in again.'}
        </div>
      </div>
    );
  }

  const drawer = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawers_mst.findFirst({
      where: { id: drawerId, tenant_org_id: tenantId, is_active: true },
    })
  );

  if (!drawer) return notFound();

  /** Load open session (if any) and closed sessions in parallel */
  const [openSessionRaw, closedSessionsRaw] = await Promise.all([
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawer_sessions_mst.findFirst({
        where: { tenant_org_id: tenantId, cash_drawer_id: drawerId, status: 'OPEN' },
      })
    ),
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawer_sessions_mst.findMany({
        where: { tenant_org_id: tenantId, cash_drawer_id: drawerId, status: 'CLOSED' },
        orderBy: { closed_at: 'desc' },
        take: 10,
      })
    ),
  ]);

  /** Load movements for the open session */
  const movementsRaw = openSessionRaw
    ? await withTenantContext(tenantId, () =>
        prisma.org_cash_drawer_movements_dtl.findMany({
          where: { tenant_org_id: tenantId, cash_drawer_session_id: openSessionRaw.id },
          orderBy: { performed_at: 'asc' },
        })
      )
    : [];

  /** Serialize Decimal fields and Date fields for RSC â†’ Client boundary */
  const openSession = openSessionRaw
    ? {
        id:                    openSessionRaw.id,
        session_no:            openSessionRaw.session_no,
        opened_at:             openSessionRaw.opened_at?.toISOString() ?? null,
        opened_by:             openSessionRaw.opened_by,
        opening_float_amount:  toNumber(openSessionRaw.opening_float_amount),
      }
    : null;

  const closedSessions = closedSessionsRaw.map((s) => ({
    id:                   s.id,
    session_no:           s.session_no,
    opened_at:            s.opened_at?.toISOString() ?? null,
    closed_at:            s.closed_at?.toISOString() ?? null,
    opening_float_amount: toNumber(s.opening_float_amount),
    expected_cash_amount: toNumber(s.expected_cash_amount),
    counted_cash_amount:  toNumber(s.counted_cash_amount),
    difference_amount:    toNumber(s.difference_amount),
  }));

  const movements = movementsRaw.map((m) => ({
    id:            m.id,
    movement_type: m.movement_type,
    direction:     m.direction,
    amount:        toNumber(m.amount),
    reason:        m.reason,
    performed_by:  m.performed_by,
    performed_at:  m.performed_at?.toISOString() ?? null,
  }));

  return (
    <div className="p-6">
      <CashDrawerDetailClient
        drawerId={drawerId}
        drawerName={drawer.drawer_name}
        drawerType={drawer.drawer_type}
        currencyCode={drawer.currency_code}
        openSession={openSession}
        movements={movements}
        closedSessions={closedSessions}
      />
    </div>
  );
}
