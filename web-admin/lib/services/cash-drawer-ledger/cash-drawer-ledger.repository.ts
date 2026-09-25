import 'server-only';

import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * The single SQL definition of a drawer ledger (CLF, ADR-057).
 *
 * A drawer ledger = its recognised cash voucher lines (finance) ∪ its custody
 * transaction lines, ordered by the per-drawer `ledger_seq`. A window is a
 * half-open sequence range (fromSeq, toSeq]. Every balance in the app — close,
 * session detail, reports — goes through here, so there is one definition of
 * "cash in the drawer".
 *
 * Voucher lines are counted when they WERE posted into the window: their
 * current `line_status` is never filtered (an original later reversed stays in
 * its own window; the reversal line sits in the window where it happened).
 */

/** Per-currency sums of one ledger window. Money stays Decimal. */
export interface LedgerWindowTotals {
  currencyCode: string;
  finIn: Decimal;
  finOut: Decimal;
  trxIn: Decimal;
  trxOut: Decimal;
  entryCount: number;
}

interface WindowRow {
  currency_code: string;
  fin_in: Prisma.Decimal;
  fin_out: Prisma.Decimal;
  trx_in: Prisma.Decimal;
  trx_out: Prisma.Decimal;
  entry_count: bigint;
}

/**
 * Sums a drawer's ledger entries with fromSeq < seq ≤ toSeq, per currency.
 * @param tx Prisma transaction or client (reads only)
 * @param tenantOrgId tenant of the drawer
 * @param drawerId drawer whose ledger is read
 * @param fromSeqExclusive lower bound (exclusive); 0 = from the beginning
 * @param toSeqInclusive upper bound (inclusive); null = up to the latest entry
 * @returns one row per currency that has entries in the window
 * @example const totals = await sumLedgerWindow(tx, tenantId, drawerId, session.open_ledger_seq, cutSeq);
 */
export async function sumLedgerWindow(
  tx: Prisma.TransactionClient,
  tenantOrgId: string,
  drawerId: string,
  fromSeqExclusive: bigint,
  toSeqInclusive: bigint | null,
): Promise<LedgerWindowTotals[]> {
  const upper = toSeqInclusive ?? BigInt('9223372036854775807');
  const rows = await tx.$queryRaw<WindowRow[]>(Prisma.sql`
    WITH entries AS (
      SELECT l.currency_code,
             'FIN' AS domain,
             l.direction,
             l.amount
        FROM org_fin_voucher_trx_lines_dtl l
       WHERE l.tenant_org_id = ${tenantOrgId}::uuid
         AND l.cash_drawer_id = ${drawerId}::uuid
         AND l.cash_effect_code = 'DRAWER'
         AND l.cash_ledger_seq > ${fromSeqExclusive}
         AND l.cash_ledger_seq <= ${upper}
      UNION ALL
      SELECT d.currency_code,
             'TRX' AS domain,
             d.direction,
             d.amount
        FROM org_cash_drawer_trx_dtl d
       WHERE d.tenant_org_id = ${tenantOrgId}::uuid
         AND d.cash_drawer_id = ${drawerId}::uuid
         AND d.ledger_seq > ${fromSeqExclusive}
         AND d.ledger_seq <= ${upper}
    )
    SELECT currency_code,
           COALESCE(SUM(amount) FILTER (WHERE domain = 'FIN' AND direction = 'IN'),  0)::numeric(19,4) AS fin_in,
           COALESCE(SUM(amount) FILTER (WHERE domain = 'FIN' AND direction = 'OUT'), 0)::numeric(19,4) AS fin_out,
           COALESCE(SUM(amount) FILTER (WHERE domain = 'TRX' AND direction = 'IN'),  0)::numeric(19,4) AS trx_in,
           COALESCE(SUM(amount) FILTER (WHERE domain = 'TRX' AND direction = 'OUT'), 0)::numeric(19,4) AS trx_out,
           COUNT(*) AS entry_count
      FROM entries
     GROUP BY currency_code
     ORDER BY currency_code
  `);

  return rows.map((r) => ({
    currencyCode: r.currency_code,
    finIn: new Decimal(r.fin_in.toString()),
    finOut: new Decimal(r.fin_out.toString()),
    trxIn: new Decimal(r.trx_in.toString()),
    trxOut: new Decimal(r.trx_out.toString()),
    entryCount: Number(r.entry_count),
  }));
}

/**
 * Net cash movement of a window, per currency: (finIn − finOut) + (trxIn − trxOut).
 * @param totals window totals from {@link sumLedgerWindow}
 * @returns map currency → net Decimal
 */
export function netOfWindow(totals: readonly LedgerWindowTotals[]): Map<string, Decimal> {
  const net = new Map<string, Decimal>();
  for (const t of totals) {
    net.set(t.currencyCode, t.finIn.minus(t.finOut).plus(t.trxIn).minus(t.trxOut));
  }
  return net;
}
