/**
 * Order Edit writer (Line-Level P6-01c; Reusable View P1B-08 Apply part).
 *
 * Why: Edit must store the calculated order the cashier reviewed, through the
 * same column mapping Create uses (`lineMoneyColumns`, `buildCommercialChildRows`),
 * so an edited order can never be stored differently from a new one.
 *
 * - Every active item and piece of the calculated order gets its §6.1
 *   columns. Rows the edit did not touch can still move (an order discount
 *   is re-split, tax rounding moves, a piece set is re-allocated), so they
 *   are written too; an unchanged row is written with the same values.
 * - The order's discount, preference-charge and tax rows are replaced: the
 *   old ones are voided (discounts, charges) or inactivated (tax lines),
 *   never deleted, so the audit keeps them. Charges that are not preference
 *   extras are kept as they are.
 * - No `EXPRESS` charge is written: the premium is on the lines (P5-02).
 * - Header totals are not written here: the rollup rebuilds them from the rows (I3).
 */
import 'server-only';

import type { Prisma } from '@prisma/client';
import { TURNAROUND_SOURCES } from '@/lib/commercial';
import { CHARGE_TYPES } from '@/lib/constants/order-financial';
import type { EditQuote } from './commercial-edit.loader';
import {
  buildCommercialChildRows,
  lineMoneyColumns,
  type ChargeMeta,
  type LineMoneyColumns,
} from './commercial-line.writer';

/** The §6.1 columns of every active row, and the header facts that move with them. */
export interface EditMoneyColumns {
  items: ReadonlyMap<string, LineMoneyColumns>;
  pieces: ReadonlyMap<string, LineMoneyColumns>;
  /** `org_orders_mst.speed_premium_amount` */
  speedPremiumAmount: string;
  /**
   * The order ready-by when a line's time was counted again (a new line or a
   * changed speed); null when every line kept its stored time.
   */
  readyBy: Date | null;
}

/**
 * Maps the calculated order to the row columns Edit writes.
 * @param edit the reviewed Edit quote
 * @returns item and piece columns by row id, and the header speed premium and ready-by
 * @throws Error when the quote has no resolved price for a line
 */
export function editMoneyColumns(edit: EditQuote): EditMoneyColumns {
  const { result, prices, facts } = edit.quote;
  const items = new Map<string, LineMoneyColumns>();
  const pieces = new Map<string, LineMoneyColumns>();
  for (const line of result.lines) {
    const price = prices.find((p) => p.lineId === line.lineId);
    const intent = edit.intent.lines.find((l) => l.lineId === line.lineId);
    if (!price || !intent) throw new Error(`The Edit quote has no price for line ${line.lineId}.`);
    const isOverride = intent.overrideUnitPrice != null;
    items.set(line.lineId, lineMoneyColumns(line.item, line, price, isOverride, facts.pricingMode));
    for (const piece of line.pieces) pieces.set(piece.rowId, lineMoneyColumns(piece, line, price, isOverride, facts.pricingMode));
  }
  const recounted = result.lines.some((line) => line.readyBy.source !== TURNAROUND_SOURCES.RECORDED);
  return {
    items,
    pieces,
    speedPremiumAmount: result.totals.speedPremiumTotal.toFixed(4),
    readyBy: recounted ? result.orderReadyBy : null,
  };
}

/** The delegates the child-row replacement uses (the Prisma transaction client). */
export interface EditChildRowsTx {
  org_order_discounts_dtl: Pick<Prisma.org_order_discounts_dtlDelegate, 'updateMany' | 'createMany'>;
  org_order_charges_dtl: Pick<Prisma.org_order_charges_dtlDelegate, 'updateMany' | 'createMany'>;
  org_order_taxes_dtl: Pick<Prisma.org_order_taxes_dtlDelegate, 'updateMany' | 'createMany'>;
}

/**
 * Replaces the order's discount, preference-charge and tax rows with the calculated ones.
 * @param tx the caller's transaction (the order row is already locked)
 * @param input the tenant, order, currency, actor, time and the reviewed Edit quote
 * @returns nothing; every write filters `tenant_org_id` and `order_id`
 * @throws Error when a calculated charge names no preference row of the edit
 * @example
 * await replaceEditChildRows(tx, { tenantOrgId, orderId, currencyCode: 'OMR', userId, at: new Date(), edit });
 */
export async function replaceEditChildRows(
  tx: EditChildRowsTx,
  input: { tenantOrgId: string; orderId: string; currencyCode: string; userId: string; at: Date; edit: EditQuote },
): Promise<void> {
  const { tenantOrgId, orderId, userId, at, edit } = input;
  const { result, facts } = edit.quote;
  const scope = { tenant_org_id: tenantOrgId, order_id: orderId };
  const keptIds = [...edit.keptChargeIds.values()];

  // ─── Retire the old rows (kept for the audit) ──────────────────────────
  await tx.org_order_discounts_dtl.updateMany({
    where: { ...scope, is_voided: false },
    data: { is_voided: true, voided_at: at, voided_by: userId, updated_at: at, updated_by: userId },
  });
  // Preference extras (and any legacy EXPRESS row) are recalculated; other charges stay.
  await tx.org_order_charges_dtl.updateMany({
    where: { ...scope, is_voided: false, ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}) },
    data: { is_voided: true, voided_at: at, voided_by: userId, updated_at: at, updated_by: userId },
  });
  await tx.org_order_taxes_dtl.updateMany({
    where: { ...scope, rec_status: 1 },
    data: { rec_status: 0, updated_at: at, updated_by: userId },
  });

  // ─── Write the calculated rows ─────────────────────────────────────────
  // A preference charge id ends with `<owner>:<kind>:<rowId>`: it points at its preference row.
  const codeByRowId = new Map<string, string>();
  for (const line of edit.intent.lines) {
    for (const p of [...line.preferences, ...(line.pieces ?? []).flatMap((piece) => piece.preferences)]) {
      if (p.rowId) codeByRowId.set(p.rowId, p.code);
    }
  }
  for (const p of edit.intent.orderPreferences) if (p.rowId) codeByRowId.set(p.rowId, p.code);
  const chargeMeta = new Map<string, ChargeMeta>();
  const recalculated = result.charges.filter((c) => !edit.keptChargeIds.has(c.chargeId));
  for (const charge of recalculated) {
    const rowId = charge.chargeId.split(':').at(-1) ?? '';
    const code = codeByRowId.get(rowId);
    // Never write a charge that no preference row explains (an orphan inflates totals).
    if (!code) throw new Error(`Charge ${charge.chargeId} has no preference row in this edit.`);
    chargeMeta.set(charge.chargeId, { sourceId: rowId, label: code });
  }
  const identity = (ids: Iterable<string>) => new Map([...ids].map((id) => [id, id] as const));
  const rows = buildCommercialChildRows({ ...result, charges: recalculated }, {
    tenantOrgId,
    orderId,
    currencyCode: input.currencyCode,
    userId,
    itemIds: identity(result.lines.map((l) => l.lineId)),
    pieceIds: identity(result.lines.flatMap((l) => l.pieces.map((p) => p.rowId))),
    adjustmentMeta: edit.adjustmentMeta,
    chargeMeta,
    taxLineMeta: new Map([...facts.taxProfileLabels].map(([id, l]) => [id, { label: l.label, label2: l.label2 }] as const)),
  });
  if (rows.discounts.length > 0) await tx.org_order_discounts_dtl.createMany({ data: rows.discounts });
  if (rows.charges.length > 0) {
    await tx.org_order_charges_dtl.createMany({
      // Kept charges hold the first sequence numbers; new ones follow.
      data: rows.charges.map((c, i) => ({ ...c, charge_type: CHARGE_TYPES.PREFERENCE, applied_seq: keptIds.length + i + 1 })),
    });
  }
  if (rows.taxes.length > 0) await tx.org_order_taxes_dtl.createMany({ data: rows.taxes });
}
