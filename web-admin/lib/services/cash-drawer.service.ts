import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { Decimal } from '@prisma/client/runtime/library';

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

/**
 *
 */
export interface SessionCloseParams {
  physicalCount: number;
  closedBy:      string;
  notes?:        string;
}

/**
 *
 */
export interface SessionCloseResult {
  session:    Awaited<ReturnType<typeof prisma.org_cash_drawer_sessions_mst.findFirstOrThrow>>;
  variance:   number;
  isBalanced: boolean;
}

/**
 *
 */
export interface CashDrawerWithCurrentSession {
  id: string;
  tenant_org_id: string;
  branch_id: string | null;
  drawer_code: string;
  drawer_name: string;
  drawer_name2: string | null;
  drawer_type: string;
  currency_code: string;
  requires_session: boolean;
  opening_float_required: boolean;
  max_cash_limit: number | null;
  assigned_terminal_id: string | null;
  is_active: boolean;
  rec_status: number;
  currentSession: {
    id: string;
    session_no: string;
    opened_at: string | null;
    opening_float_amount: number;
  } | null;
}

/**
 *
 * @param tenantId
 * @param branchId
 */
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

/**
 * Returns active drawers together with their current OPEN session, if one exists.
 *
 * Why:
 * POS cash collection needs a single place to show whether a cashier can take
 * cash immediately or must open a session first. Returning the drawer and its
 * open session in one payload keeps the client logic deterministic.
 *
 * @param tenantId Tenant identifier used to scope drawer and session lookups.
 * @param branchId Optional branch filter so POS checkout resolves branch-local drawers first.
 * @returns Active drawers plus a nullable `currentSession` snapshot for each drawer.
 *
 * @example
 * await getDrawersWithCurrentSession('tenant-001', 'branch-001');
 */
export async function getDrawersWithCurrentSession(
  tenantId: string,
  branchId?: string
): Promise<CashDrawerWithCurrentSession[]> {
  const drawers = await getDrawers(tenantId, branchId);

  if (drawers.length === 0) {
    return [];
  }

  const sessions = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        cash_drawer_id: { in: drawers.map((drawer) => drawer.id) },
        status: 'OPEN',
        is_active: true,
      },
      select: {
        id: true,
        cash_drawer_id: true,
        session_no: true,
        opened_at: true,
        opening_float_amount: true,
      },
    })
  );

  const sessionMap = new Map(sessions.map((session) => [session.cash_drawer_id, session]));

  return drawers.map((drawer) => {
    const currentSession = sessionMap.get(drawer.id) ?? null;

    return {
      id: drawer.id,
      tenant_org_id: drawer.tenant_org_id,
      branch_id: drawer.branch_id,
      drawer_code: drawer.drawer_code,
      drawer_name: drawer.drawer_name,
      drawer_name2: drawer.drawer_name2,
      drawer_type: drawer.drawer_type,
      currency_code: drawer.currency_code,
      requires_session: drawer.requires_session,
      opening_float_required: drawer.opening_float_required,
      max_cash_limit: drawer.max_cash_limit != null ? Number(drawer.max_cash_limit) : null,
      assigned_terminal_id: drawer.assigned_terminal_id,
      is_active: drawer.is_active,
      rec_status: drawer.rec_status,
      currentSession: currentSession
        ? {
            id: currentSession.id,
            session_no: currentSession.session_no,
            opened_at: currentSession.opened_at?.toISOString() ?? null,
            opening_float_amount: Number(currentSession.opening_float_amount),
          }
        : null,
    };
  });
}

/**
 * Resolves the OPEN cash-drawer session to use for a cash-taking flow.
 *
 * Why:
 * order submission can safely auto-bind a session only when there is exactly
 * one valid OPEN session in scope. Multiple open sessions require an explicit
 * cashier choice to avoid routing cash into the wrong drawer.
 *
 * @param tenantId Tenant identifier used to scope session lookups.
 * @param branchId Optional branch filter so branch checkout resolves only local sessions.
 * @param requestedSessionId Session ID already chosen by the caller, if any.
 * @returns The provided session ID or the single resolvable OPEN session ID.
 * @throws Error('CASH_DRAWER_SESSION_REQUIRED') when no OPEN session exists in scope.
 * @throws Error('CASH_DRAWER_SESSION_SELECTION_REQUIRED') when multiple OPEN sessions exist in scope.
 *
 * @example
 * await resolveCashDrawerSessionId('tenant-001', 'branch-001');
 */
export async function resolveCashDrawerSessionId(
  tenantId: string,
  branchId?: string,
  requestedSessionId?: string
): Promise<string> {
  if (requestedSessionId) {
    return requestedSessionId;
  }

  const sessions = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        status: 'OPEN',
        is_active: true,
        ...(branchId ? { branch_id: branchId } : {}),
      },
      select: { id: true },
      orderBy: [{ opened_at: 'desc' }],
      take: 2,
    })
  );

  if (sessions.length === 0) {
    throw new Error('CASH_DRAWER_SESSION_REQUIRED');
  }

  if (sessions.length > 1) {
    throw new Error('CASH_DRAWER_SESSION_SELECTION_REQUIRED');
  }

  return sessions[0].id;
}

/**
 *
 * @param tenantId
 * @param drawerId
 * @param params
 * @param params.openingBalance
 * @param params.openedBy
 * @param params.notes
 */
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

/**
 *
 * @param tenantId
 * @param sessionId
 * @param params
 */
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

/**
 *
 * @param tenantId
 * @param drawerId
 * @param params
 * @param params.movementType
 * @param params.amount
 * @param params.reason
 * @param params.performedBy
 */
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

/**
 *
 * @param tenantId
 * @param sessionId
 */
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
 * @param tenantId
 * @param drawerId
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
