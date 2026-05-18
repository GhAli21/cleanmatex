import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { Decimal } from '@prisma/client/runtime/library';

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

export interface SessionCloseParams {
  physicalCount: number;
  closedBy:      string;
  notes?:        string;
}

export interface SessionCloseResult {
  session:    Awaited<ReturnType<typeof prisma.org_cash_drawer_sessions_mst.findFirstOrThrow>>;
  variance:   number;
  isBalanced: boolean;
}

export async function getDrawers(tenantId: string, branchId?: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_cash_drawers_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        is_active:     true,
        rec_status:    1,
        ...(branchId ? { branch_id: branchId } : {}),
      },
      orderBy: { created_at: 'asc' },
    })
  );
}

export async function openSession(
  tenantId: string,
  drawerId:  string,
  params: { openingBalance: number; openedBy: string; notes?: string }
) {
  // Look up drawer to get branch_id and currency_code (required for session)
  const drawer = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawers_mst.findFirstOrThrow({
      where: { id: drawerId, tenant_org_id: tenantId },
    })
  );

  // Verify no OPEN session already exists
  const existing = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findFirst({
      where: { tenant_org_id: tenantId, cash_drawer_id: drawerId, status: 'OPEN' },
    })
  );
  if (existing) throw new Error('A session is already open for this drawer');

  const count = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.count({ where: { tenant_org_id: tenantId } })
  );
  const sessionNo = `SES-${String(count + 1).padStart(6, '0')}`;

  return withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.create({
      data: {
        tenant_org_id:        tenantId,
        branch_id:            drawer.branch_id,
        cash_drawer_id:       drawerId,
        session_no:           sessionNo,
        status:               'OPEN',
        currency_code:        drawer.currency_code,
        opening_float_amount: params.openingBalance,
        opened_by:            params.openedBy,
        opened_at:            new Date(),
        is_active:            true,
        rec_status:           1,
      },
    })
  );
}

export async function closeSession(
  tenantId:  string,
  sessionId: string,
  params:    SessionCloseParams
): Promise<SessionCloseResult> {
  const session = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findFirstOrThrow({
      where: { id: sessionId, tenant_org_id: tenantId, status: 'OPEN' },
    })
  );

  // Sum all CASH payments linked to this session
  const cashPayments = await withTenantContext(tenantId, () =>
    prisma.org_order_payments_dtl.aggregate({
      where:   { tenant_org_id: tenantId, cash_drawer_session_id: sessionId },
      _sum:    { amount: true },
    })
  );

  const cashIn       = toNumber(cashPayments._sum.amount);
  const expectedCash = toNumber(session.opening_float_amount) + cashIn;
  const variance     = params.physicalCount - expectedCash;
  const isBalanced   = Math.abs(variance) < 0.01;

  const updated = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.update({
      where: { id: sessionId },
      data:  {
        status:               'CLOSED',
        counted_cash_amount:  params.physicalCount,
        expected_cash_amount: expectedCash,
        difference_amount:    variance,
        closed_by:            params.closedBy,
        closed_at:            new Date(),
        close_notes:          params.notes ?? null,
        updated_at:           new Date(),
      },
    })
  );

  return { session: updated, variance, isBalanced };
}

export async function recordMovement(
  tenantId:  string,
  drawerId:  string,
  params: {
    movementType: 'CASH_IN' | 'CASH_OUT' | 'PETTY_CASH';
    amount:       number;
    reason:       string;
    performedBy:  string;
  }
) {
  const session = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findFirst({
      where: { tenant_org_id: tenantId, cash_drawer_id: drawerId, status: 'OPEN' },
    })
  );
  if (!session) throw new Error('No open session found for this drawer');

  const direction = params.movementType === 'CASH_IN' ? 'IN' : 'OUT';

  return withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_movements_dtl.create({
      data: {
        tenant_org_id:          tenantId,
        branch_id:              session.branch_id,
        cash_drawer_id:         drawerId,
        cash_drawer_session_id: session.id,
        movement_type:          params.movementType,
        direction,
        amount:                 params.amount,
        currency_code:          session.currency_code,
        reason:                 params.reason,
        performed_by:           params.performedBy,
        performed_at:           new Date(),
        is_active:              true,
        rec_status:             1,
      },
    })
  );
}

export async function getSessionSummary(tenantId: string, sessionId: string) {
  const [session, movements, payments] = await Promise.all([
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawer_sessions_mst.findFirstOrThrow({
        where: { id: sessionId, tenant_org_id: tenantId },
      })
    ),
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawer_movements_dtl.findMany({
        where:   { tenant_org_id: tenantId, cash_drawer_session_id: sessionId },
        orderBy: { performed_at: 'asc' },
      })
    ),
    withTenantContext(tenantId, () =>
      prisma.org_order_payments_dtl.findMany({
        where:   { tenant_org_id: tenantId, cash_drawer_session_id: sessionId },
        orderBy: { created_at: 'asc' },
      })
    ),
  ]);

  const totalCashIn   = movements.filter((m) => m.direction === 'IN').reduce((s, m) => s + toNumber(m.amount), 0);
  const totalCashOut  = movements.filter((m) => m.direction === 'OUT').reduce((s, m) => s + toNumber(m.amount), 0);
  const totalPayments = payments.reduce((s, p) => s + toNumber(p.amount), 0);

  return { session, movements, payments, totalCashIn, totalCashOut, totalPayments };
}

/**
 * Verify a drawer has an open session before allowing cash payment routing.
 */
export async function validateDrawerForCashPayment(tenantId: string, drawerId: string): Promise<string> {
  const session = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findFirst({
      where: { tenant_org_id: tenantId, cash_drawer_id: drawerId, status: 'OPEN' },
    })
  );
  if (!session) throw new Error('No open cash drawer session. Please open a session before taking cash payments.');
  return session.id;
}
