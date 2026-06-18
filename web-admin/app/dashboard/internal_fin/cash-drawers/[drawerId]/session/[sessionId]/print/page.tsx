/**
 * Cash Drawer Session Report Print Page
 * Route: /dashboard/internal_fin/cash-drawers/[drawerId]/session/[sessionId]/print
 */

import { notFound } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getSessionSummary } from '@/lib/services/cash-drawer.service';
import { CashDrawerSessionPrintRprt } from '@features/billing/ui/cash-drawer-session-print-rprt';
import { Decimal } from '@prisma/client/runtime/library';

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

  const { session, movements, payments, totalCashIn, totalCashOut, totalPayments } = summary;

  const openingBalance = toNumber(session.opening_float_amount);
  const closingBalance = toNumber(session.counted_cash_amount);
  const physicalCount  = toNumber(session.counted_cash_amount);
  const expectedBalance = openingBalance + totalCashIn - totalCashOut + totalPayments;
  const variance = physicalCount > 0 ? physicalCount - expectedBalance : null;

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
    <CashDrawerSessionPrintRprt
      session={serializedSession}
      movements={serializedMovements}
      payments={serializedPayments}
      totals={{
        totalCashIn,
        totalCashOut,
        totalPayments,
        expectedBalance,
        variance,
      }}
    />
  );
}
