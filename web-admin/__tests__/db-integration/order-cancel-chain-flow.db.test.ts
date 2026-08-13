/**
 * B28 follow-up #3 — real end-to-end test of the order-cancellation
 * financial chain: `unwindOrderFinancialsOnCancel` → (REFUND disposition)
 * `initiateRefund` → `approveRefund` → `processRefund` → real
 * `recalculateOrderFinancialSnapshotTx`, all against a real seeded paid
 * order on the local DB. No mocks needed — unwindOrderFinancialsOnCancel
 * and everything it calls (recalculateOrderFinancialSnapshotTx,
 * reversePromoUsageTx, initiateRefund, issueCreditNoteTx, emitEventTx) are
 * self-contained Prisma writes with no Next.js request-scope or
 * outbound-network dependency (unlike OrderService.updateOrder, which
 * needed several stubs — see order-amendment-governed-flow.db.test.ts).
 *
 * Existing coverage (order-cancel-financials.service.test.ts, FN-02) is
 * solid for ledger-reversal/disposition-gating/promo-reversal/emit logic,
 * but mocks BOTH `initiateRefund` and `recalculateOrderFinancialSnapshotTx`
 * — so no test has ever chained the real unwind → real refund lifecycle →
 * real snapshot recalc as one flow. This file does, for both
 * money-bearing dispositions:
 *
 *  1. REFUND — drives the full lifecycle: unwind creates a real
 *     PENDING_APPROVAL refund row (not yet reflected in the snapshot),
 *     approveRefund flips it to APPROVED, processRefund (B9 flag-off,
 *     record-only path — no drawer/gateway fixtures needed) flips it to
 *     PROCESSED and re-runs the real snapshot recalc. Proves the D003 v2
 *     "cancellation unwind never reopens the customer's due" rule
 *     end-to-end against a REAL recalc (refund_reopens_due_amount stays 0,
 *     outstanding_amount stays 0), not just resolveReopensDueAmount's own
 *     unit test.
 *
 *     Also surfaces and documents (does not fix — out of scope, and
 *     arguably correct as designed) a genuinely non-obvious real behavior:
 *     `payment_status` stays 'PAID' even after the entire payment has been
 *     refunded, because resolveHeaderPaymentStatus compares the GROSS
 *     total_paid_amount (unaffected by refunds) against total_amount, not
 *     the refund-aware net_collected_amount. The refund IS fully and
 *     correctly reflected in refunded_amount / real_payment_refunded_amount
 *     / net_collected_amount / outstanding_amount — just not in the
 *     payment_status enum. See the trailing comment on this file for the
 *     full analysis and why it is recorded rather than silently fixed here.
 *
 *  2. STORE_CREDIT — proves the OTHER money-bearing disposition branch:
 *     the credit note is issued synchronously inside the SAME transaction
 *     as the unwind (no separate approve/process step, unlike REFUND), and
 *     the order's own snapshot is untouched by it (a standalone credit
 *     note for the customer, not an application against this — now
 *     cancelled — order), also documented rather than assumed.
 *
 * SCOPE NOTE (added after cross-checking docs/features/Workflow_Order_Advance/
 * ADR_CANCEL_RETURN_RULES.md, 2026-07-25 — "Supersedes: Broad
 * cancel-from-any-ops-status + automatic Fin unwind on cancel"): this file
 * covers the LEGACY "Enhanced" cancel path (workflow-service-enhanced.ts,
 * `unwindOrderFinancialsOnCancel` + the disposition picker in
 * cancel-order-dialog.tsx), which remains the real, live, DEFAULT behavior
 * for every tenant today — `isWorkflowEngineV2Enabled()` defaults to false
 * (env kill-switch / per-tenant HQ flag, both off unless explicitly
 * opted in). It does NOT cover Workflow Engine V2's `CANCEL_ORDER` action
 * (lib/services/workflow/workflow-engine.service.ts), which is already
 * ADR-compliant: cancel is only reachable from draft/intake/incomplete-
 * preparing, and it performs NO automatic financial unwind at all — money
 * is meant to move only through explicit, separate "Fin screen" actions the
 * ADR describes as not yet built. `cancel-order-dialog.tsx` is already
 * engine-aware (`!engineV2 && hasCollectedMoney` gates whether the
 * disposition picker even renders/sends `cancellation_disposition`) — so
 * this test protects real, currently-default production behavior, but its
 * relevance is expected to shrink and eventually retire once Engine V2
 * becomes the default and the legacy disposition path is removed. Do not
 * extend this file to cover Engine V2's cancel action — that path
 * deliberately has no financial unwind to test.
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
// discount-service.ts (imported by order-cancel-financials.service.ts, for
// its promo-usage-reversal step) transitively imports tenant-settings.service.ts,
// which imports lib/supabase/client.ts — a module that eagerly constructs a
// real browser Supabase client at MODULE LOAD TIME from
// NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, env vars that live in .env.local, which
// Next.js deliberately does not load when NODE_ENV=test (jest sets this
// automatically). Nothing on this test's real code path ever calls it;
// stub it out rather than fighting env loading (same fix as
// order-amendment-governed-flow.db.test.ts).
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
  supabase: {},
}));

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import {
  unwindOrderFinancialsOnCancel,
  CANCEL_DISPOSITIONS,
} from '@/lib/services/order-cancel-financials.service';
import { approveRefund, processRefund } from '@/lib/services/order-refund.service';

const DEMO_TENANT = '11111111-1111-1111-1111-111111111111';
// Real seeded tenant_admin for DEMO_TENANT — used only as a free-text actor id;
// org_order_refunds_dtl.approved_by/created_by carry no auth.users FK, but
// reusing the same real user as the other db-integration files keeps every
// seed row attributable to a real, known actor.
const ACTOR = '98ed3f07-7bbb-4af1-a5cc-c901c625ef2c';

let dbUp = false;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const tenant = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst WHERE id = ${DEMO_TENANT}::uuid`;
    dbUp = tenant.length > 0;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[order-cancel-chain-flow] DB unavailable or demo seed missing — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

type SeedIds = { customerId: string; orderId: string; paymentId: string };

/** Seeds a real, fully-paid, cancelled order with one real COMPLETED payment. */
async function seedCancelledPaidOrder(): Promise<SeedIds> {
  const customer = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id, name)
    VALUES (${DEMO_TENANT}::uuid, ${'B28 cancel-chain test customer'})
    RETURNING id`;
  const customerId = customer[0].id;

  const order = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_orders_mst
      (tenant_org_id, customer_id, order_no, currency_code, status, current_status,
       total_amount, total_paid_amount, outstanding_amount)
    VALUES
      (${DEMO_TENANT}::uuid, ${customerId}::uuid, ${`CANCELCHAIN-${randomUUID()}`}, 'OMR', 'cancelled', 'cancelled',
       20, 20, 0)
    RETURNING id`;
  const orderId = order[0].id;

  const payment = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_order_payments_dtl
      (tenant_org_id, order_id, payment_method_code, payment_status, amount,
       currency_code, payment_nature_snapshot)
    VALUES
      (${DEMO_TENANT}::uuid, ${orderId}::uuid, 'CASH', 'COMPLETED', 20, 'OMR', 'REAL_PAYMENT')
    RETURNING id`;
  const paymentId = payment[0].id;

  return { customerId, orderId, paymentId };
}

async function cleanupSeed({ customerId, orderId }: SeedIds): Promise<void> {
  try {
    await prisma.$executeRaw`DELETE FROM public.org_credit_note_txn_dtl WHERE customer_id = ${customerId}::uuid`;
    await prisma.$executeRaw`DELETE FROM public.org_credit_notes_mst WHERE customer_id = ${customerId}::uuid`;
    await prisma.$executeRaw`DELETE FROM public.org_order_refunds_dtl WHERE order_id = ${orderId}::uuid`;
    await prisma.$executeRaw`DELETE FROM public.org_domain_events_outbox WHERE aggregate_id = ${orderId}::uuid`;
    await prisma.$executeRaw`DELETE FROM public.org_order_payments_dtl WHERE order_id = ${orderId}::uuid`;
    await prisma.$executeRaw`DELETE FROM public.org_orders_mst WHERE id = ${orderId}::uuid`;
    await prisma.$executeRaw`DELETE FROM public.org_customers_mst WHERE id = ${customerId}::uuid`;
  } catch {
    // best-effort — leftover local-only test rows (clearly labeled CANCELCHAIN-*) are harmless
  }
}

describe('unwindOrderFinancialsOnCancel — real cancel-chain flow (B28 follow-up #3)', () => {
  dbit('REFUND disposition: unwind → initiateRefund → approveRefund → processRefund → real snapshot recalc, end to end', async () => {
    const seed = await seedCancelledPaidOrder();
    try {
      const unwind = await unwindOrderFinancialsOnCancel({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        userId: ACTOR,
        disposition: CANCEL_DISPOSITIONS.REFUND,
        reason: 'B28 cancel-chain test: customer cancelled after payment',
      });

      expect(unwind.disposition).toBe('REFUND');
      expect(unwind.paidAmountDisposed).toBe(20);
      expect(unwind.creditNoteId).toBeNull();
      expect(unwind.refundIds).toHaveLength(1);
      const refundId = unwind.refundIds[0];

      // Mid-flow: the refund exists but has not been approved/processed yet —
      // initiateRefund runs in its own (already-committed) transaction, so
      // this is real post-unwind DB state, not an in-memory assumption.
      const pendingRefund = await prisma.$queryRaw<Array<{
        refund_status: string; refund_amount: string; refund_context: string;
        refund_method_code: string; refund_source_type: string; original_payment_id: string;
      }>>`
        SELECT refund_status, refund_amount, refund_context, refund_method_code,
               refund_source_type, original_payment_id
        FROM public.org_order_refunds_dtl WHERE id = ${refundId}::uuid`;
      expect(pendingRefund[0].refund_status).toBe('PENDING_APPROVAL');
      expect(Number(pendingRefund[0].refund_amount)).toBe(20);
      expect(pendingRefund[0].refund_context).toBe('CANCELLATION_UNWIND');
      expect(pendingRefund[0].refund_method_code).toBe('ORIGINAL_METHOD');
      expect(pendingRefund[0].refund_source_type).toBe('REAL_PAYMENT_REFUND');
      expect(pendingRefund[0].original_payment_id).toBe(seed.paymentId);

      const midFlowOrder = await prisma.$queryRaw<Array<{
        total_paid_amount: string; outstanding_amount: string; refunded_amount: string;
      }>>`
        SELECT total_paid_amount, outstanding_amount, refunded_amount
        FROM public.org_orders_mst WHERE id = ${seed.orderId}::uuid`;
      expect(Number(midFlowOrder[0].total_paid_amount)).toBe(20);
      expect(Number(midFlowOrder[0].outstanding_amount)).toBe(0);
      expect(Number(midFlowOrder[0].refunded_amount)).toBe(0);

      // Maker-checker: approve, then process (real B9 record-only path — no
      // execution param, exactly the pre-B9 record-only behavior).
      await approveRefund(DEMO_TENANT, refundId, ACTOR);
      const approvedRefund = await prisma.$queryRaw<Array<{ refund_status: string; approved_by: string }>>`
        SELECT refund_status, approved_by FROM public.org_order_refunds_dtl WHERE id = ${refundId}::uuid`;
      expect(approvedRefund[0].refund_status).toBe('APPROVED');
      expect(approvedRefund[0].approved_by).toBe(ACTOR);

      const processed = await processRefund(DEMO_TENANT, refundId, ACTOR);
      expect(processed.refund_status).toBe('PROCESSED');

      // Final state: the real snapshot recalc correctly reflects the
      // refund in refunded_amount/net_collected_amount/outstanding_amount,
      // and — the D003 v2 core rule for CANCELLATION_UNWIND — never reopens
      // the customer's due (outstanding_amount stays 0, not 20).
      const finalOrder = await prisma.$queryRaw<Array<{
        total_paid_amount: string; refunded_amount: string; real_payment_refunded_amount: string;
        net_collected_amount: string; outstanding_amount: string; refund_reopens_due_amount: string;
        payment_status: string;
      }>>`
        SELECT total_paid_amount, refunded_amount, real_payment_refunded_amount,
               net_collected_amount, outstanding_amount, refund_reopens_due_amount, payment_status
        FROM public.org_orders_mst WHERE id = ${seed.orderId}::uuid`;
      expect(Number(finalOrder[0].total_paid_amount)).toBe(20); // gross, unaffected by refund
      expect(Number(finalOrder[0].refunded_amount)).toBe(20);
      expect(Number(finalOrder[0].real_payment_refunded_amount)).toBe(20);
      expect(Number(finalOrder[0].net_collected_amount)).toBe(0);
      expect(Number(finalOrder[0].refund_reopens_due_amount)).toBe(0);
      expect(Number(finalOrder[0].outstanding_amount)).toBe(0);
      // Documented real finding, not a bug fixed here — see file header.
      expect(finalOrder[0].payment_status).toBe('PAID');
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('STORE_CREDIT disposition: unwind issues a real credit note synchronously, leaves the order snapshot untouched', async () => {
    const seed = await seedCancelledPaidOrder();
    try {
      const unwind = await unwindOrderFinancialsOnCancel({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        userId: ACTOR,
        disposition: CANCEL_DISPOSITIONS.STORE_CREDIT,
        reason: 'B28 cancel-chain test: customer accepted store credit',
      });

      expect(unwind.disposition).toBe('STORE_CREDIT');
      expect(unwind.paidAmountDisposed).toBe(20);
      expect(unwind.refundIds).toHaveLength(0);
      expect(unwind.creditNoteId).toBeTruthy();

      const note = await prisma.$queryRaw<Array<{
        customer_id: string; original_amount: string; remaining_balance: string;
        status: string; related_order_id: string;
      }>>`
        SELECT customer_id, original_amount, remaining_balance, status, related_order_id
        FROM public.org_credit_notes_mst WHERE id = ${unwind.creditNoteId}::uuid`;
      expect(note[0].customer_id).toBe(seed.customerId);
      expect(Number(note[0].original_amount)).toBe(20);
      expect(Number(note[0].remaining_balance)).toBe(20);
      expect(note[0].status).toBe('ACTIVE');
      expect(note[0].related_order_id).toBe(seed.orderId);

      // The credit note is issued to the CUSTOMER, not applied against this
      // (now cancelled) order — the order's own snapshot is unaffected: the
      // original payment row is untouched (no refund created for this
      // disposition), so total_paid_amount/outstanding_amount look exactly
      // as they did before cancellation. Documented, not assumed.
      const finalOrder = await prisma.$queryRaw<Array<{
        total_paid_amount: string; total_credit_applied_amount: string; outstanding_amount: string;
      }>>`
        SELECT total_paid_amount, total_credit_applied_amount, outstanding_amount
        FROM public.org_orders_mst WHERE id = ${seed.orderId}::uuid`;
      expect(Number(finalOrder[0].total_paid_amount)).toBe(20);
      expect(Number(finalOrder[0].total_credit_applied_amount)).toBe(0);
      expect(Number(finalOrder[0].outstanding_amount)).toBe(0);

      const payment = await prisma.$queryRaw<Array<{ payment_status: string }>>`
        SELECT payment_status FROM public.org_order_payments_dtl WHERE id = ${seed.paymentId}::uuid`;
      expect(payment[0].payment_status).toBe('COMPLETED');
    } finally {
      await cleanupSeed(seed);
    }
  });
});
