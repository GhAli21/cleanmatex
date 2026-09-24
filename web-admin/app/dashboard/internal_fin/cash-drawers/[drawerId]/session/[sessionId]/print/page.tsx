/**
 * Cash Drawer Session Report Print Page
 * Route: /dashboard/internal_fin/cash-drawers/[drawerId]/session/[sessionId]/print
 */

import { notFound } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getSessionSummary } from '@/lib/services/cash-drawer.service';
import { CashDrawerSessionPrintRprt } from '@features/billing/ui/cash-drawer-session-print-rprt';
import { Decimal } from '@prisma/client/runtime/library';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { BILLING_INTERNAL_FIN_CASH_DRAWERS_SESSION_PRINT_ACCESS } from '@features/billing/access/billing-access'

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

interface PageProps {
  params: Promise<{ drawerId: string; sessionId: string }>;
}

/**
 *
 * @param root0
 * @param root0.params
 */
export default async function CashDrawerSessionPrintPage({ params }: PageProps) {
  const { sessionId } = await params;

  const { tenantId } = await getAuthContext();

  let summary: Awaited<ReturnType<typeof getSessionSummary>>;
  try {
    summary = await getSessionSummary(tenantId, sessionId);
  } catch {
    notFound();
  }

  const { session, movements, payments, reconciliation } = summary;

  // A3-4: `reconciliation.expectedCash`/`.variance` are already computed in
  // Decimal space by the service (A3-7's `buildSessionReconciliation`) and
  // serialized as exact strings. Previously this page recomputed
  // `expectedBalance`/`variance` itself with plain JS `+`/`-` over
  // already-lossy `Number()` conversions — the same float-drift class A3-1/
  // A3-7 fixed in the write/read paths, just reintroduced a third time here.
  // `Number()` of an already-exact decimal string is safe at this point
  // because it is the terminal print-formatting boundary — nothing
  // downstream computes on these values further.
  const openingBalance = Number(reconciliation.openingFloat);
  const closingBalance = reconciliation.countedCash != null ? Number(reconciliation.countedCash) : 0;
  const physicalCount = closingBalance;
  const expectedBalance = Number(reconciliation.expectedCash);
  const variance = reconciliation.variance != null ? Number(reconciliation.variance) : null;

  const serializedSession = {
    id:              session.id,
    session_no:      session.session_no ?? '',
    status:          session.status ?? 'UNKNOWN',
    currency_code:   session.currency_code ?? 'OMR',
    opening_balance: openingBalance,
    closing_balance: closingBalance,
    physical_count:  physicalCount,
    opened_at:       session.opened_at?.toISOString() ?? null,
    closed_at:       session.closed_at?.toISOString() ?? null,
    opened_by:       session.opened_by ?? null,
    closed_by:       session.closed_by ?? null,
    notes:           session.close_notes ?? null,
  };

  const serializedMovements = movements.map((m) => ({
    id:           m.id,
    direction:    m.direction ?? 'IN',
    movement_type: m.movement_type ?? 'MANUAL',
    amount:       toNumber(m.amount),
    reason:       m.reason ?? null,
    performed_by: m.performed_by ?? null,
    performed_at: m.performed_at?.toISOString() ?? new Date().toISOString(),
  }));

  const serializedPayments = payments.map((p) => ({
    id:                     p.id,
    payment_method_code:    p.payment_method_code ?? 'CASH',
    amount:                 toNumber(p.amount),
    payment_status:         p.payment_status ?? null,
    created_at:             p.created_at?.toISOString() ?? new Date().toISOString(),
  }));

  return (
    <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_CASH_DRAWERS_SESSION_PRINT_ACCESS.page.permissions ?? []}>
      <CashDrawerSessionPrintRprt
      session={serializedSession}
      movements={serializedMovements}
      payments={serializedPayments}
      totals={{
        totalCashIn: Number(reconciliation.movementCashIn),
        totalCashOut: Number(reconciliation.movementCashOut),
        totalPayments: Number(reconciliation.cashCollected),
        expectedBalance,
        variance,
      }}
    />
    </RequireAnyPermission>
  );
}
