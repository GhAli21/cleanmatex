import 'server-only';

import { Prisma } from '@prisma/client';
import type { prisma } from '@/lib/db/prisma';
import { toMoneyString } from '@/lib/utils/money';
import type { PosSessionSummary } from '@/lib/types/pos-session';

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * A3-2 (POS Session & Cash Drawer Hardening) — the raw SQL below casts every
 * SUM(...) to `::text`, not `::float8`. `::float8` forced Postgres to
 * compute (and round) the aggregate in IEEE-754 double precision *inside the
 * database*, before the value ever reaches JS — a running SUM over many
 * transactions can accumulate binary-rounding error server-side that no
 * amount of careful JS-side math can undo. `::text` makes Postgres do the
 * SUM in exact NUMERIC space and hand over an exact decimal string.
 *
 * A3-4: that exact string is now passed through to the API as-is (normalized
 * to a fixed MONEY_SCALE via `toMoneyString`) instead of being parsed into a
 * JS `number` here — a `Number()` parse was already lossless for any
 * realistic money total, but keeping the wire type as `string` end to end
 * means nothing downstream can ever reintroduce float rounding by accident.
 */
function parseNumericSum(value: string): string {
  return toMoneyString(value);
}

/**
 * Aggregates a POS session's payments, refunds and voucher lines per currency — the shared
 * financial roll-up behind the session summary and the X/Z shift reports. Runs on any Prisma
 * client or transaction handle so the Z-report can compute it inside the closing transaction.
 * Exact `NUMERIC` sums cast to text; every query filters `tenant_org_id` explicitly.
 *
 * @param db Prisma client or transaction
 * @param tenantId owning tenant
 * @param posSessionId the POS session to roll up
 * @returns the roll-up without the session row itself
 */
export async function loadPosSessionRollup(
  db: Pick<PrismaTx, '$queryRaw'>,
  tenantId: string,
  posSessionId: string
): Promise<Omit<PosSessionSummary, 'session' | 'drawerCash'>> {
  const [paymentTotals, paymentGroups, refundTotals, refundGroups, voucherTotals, voucherGroups] =
    await Promise.all([
      // A4-1 — no LIMIT: a mixed-currency session must return one row per
      // currency, not silently drop every currency but one.
      db.$queryRaw<Array<{ currency_code: string | null; amount: string; count: number }>>(Prisma.sql`
        SELECT currency_code, COALESCE(SUM(amount), 0)::text AS amount, COUNT(*)::int AS count
        FROM public.org_order_payments_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND pos_session_id = ${posSessionId}::uuid
          AND is_active = TRUE
        GROUP BY currency_code
        ORDER BY currency_code NULLS LAST
      `),
      db.$queryRaw<Array<{ payment_method_code: string | null; payment_status: string | null; currency_code: string | null; amount: string; count: number }>>(Prisma.sql`
        SELECT payment_method_code, payment_status, currency_code,
               COALESCE(SUM(amount), 0)::text AS amount,
               COUNT(*)::int AS count
        FROM public.org_order_payments_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND pos_session_id = ${posSessionId}::uuid
          AND is_active = TRUE
        GROUP BY payment_method_code, payment_status, currency_code
        ORDER BY payment_method_code NULLS LAST, payment_status NULLS LAST
      `),
      db.$queryRaw<Array<{ currency_code: string | null; amount: string; count: number }>>(Prisma.sql`
        SELECT currency_code, COALESCE(SUM(refund_amount), 0)::text AS amount, COUNT(*)::int AS count
        FROM public.org_order_refunds_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND pos_session_id = ${posSessionId}::uuid
          AND is_active = TRUE
        GROUP BY currency_code
        ORDER BY currency_code NULLS LAST
      `),
      db.$queryRaw<Array<{ refund_method_code: string | null; refund_status: string | null; currency_code: string | null; amount: string; count: number }>>(Prisma.sql`
        SELECT refund_method_code, refund_status, currency_code,
               COALESCE(SUM(refund_amount), 0)::text AS amount,
               COUNT(*)::int AS count
        FROM public.org_order_refunds_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND pos_session_id = ${posSessionId}::uuid
          AND is_active = TRUE
        GROUP BY refund_method_code, refund_status, currency_code
        ORDER BY refund_method_code NULLS LAST, refund_status NULLS LAST
      `),
      db.$queryRaw<Array<{ currency_code: string | null; amount: string; count: number }>>(Prisma.sql`
        SELECT currency_code, COALESCE(SUM(amount), 0)::text AS amount, COUNT(*)::int AS count
        FROM public.org_fin_voucher_trx_lines_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND pos_session_id = ${posSessionId}::uuid
          AND is_active = TRUE
        GROUP BY currency_code
        ORDER BY currency_code NULLS LAST
      `),
      db.$queryRaw<Array<{ line_role: string | null; payment_method_code: string | null; direction: string | null; currency_code: string | null; amount: string; count: number }>>(Prisma.sql`
        SELECT line_role, payment_method_code, direction, currency_code,
               COALESCE(SUM(amount), 0)::text AS amount,
               COUNT(*)::int AS count
        FROM public.org_fin_voucher_trx_lines_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND pos_session_id = ${posSessionId}::uuid
          AND is_active = TRUE
        GROUP BY line_role, payment_method_code, direction, currency_code
        ORDER BY line_role NULLS LAST, payment_method_code NULLS LAST
      `),
    ]);

  return {
    payments: {
      // A4-1 — every currency the session actually collected, not just
      // the alphabetically-first one.
      totals: paymentTotals.map((row) => ({
        currencyCode: row.currency_code,
        amount: parseNumericSum(row.amount),
        count: row.count,
      })),
      byMethod: paymentGroups.map((row) => ({
        groupCode: row.payment_method_code,
        status: row.payment_status,
        currencyCode: row.currency_code,
        amount: parseNumericSum(row.amount),
        count: row.count,
      })),
    },
    refunds: {
      totals: refundTotals.map((row) => ({
        currencyCode: row.currency_code,
        amount: parseNumericSum(row.amount),
        count: row.count,
      })),
      byMethod: refundGroups.map((row) => ({
        groupCode: row.refund_method_code,
        status: row.refund_status,
        currencyCode: row.currency_code,
        amount: parseNumericSum(row.amount),
        count: row.count,
      })),
    },
    voucherLines: {
      totals: voucherTotals.map((row) => ({
        currencyCode: row.currency_code,
        amount: parseNumericSum(row.amount),
        count: row.count,
      })),
      byRole: voucherGroups.map((row) => ({
        lineRole: row.line_role,
        paymentMethodCode: row.payment_method_code,
        direction: row.direction,
        currencyCode: row.currency_code,
        amount: parseNumericSum(row.amount),
        count: row.count,
      })),
    },
  };
}
