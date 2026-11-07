/**
 * Create-side bridge from a checkout quote to the rows Create writes (P5-02).
 *
 * Why: `createOrderInTransaction` still owns the row structure (workflow
 * state, preference rows, pieces, notes, colours). This session hands it the
 * money for each row from the one calculated order and collects the created
 * ids, so the line writer can build the discount, charge and tax rows that
 * point at them. No money is computed here; every figure is the calculator's.
 */
import 'server-only';

import { PRICED_PREFERENCE_SYS_KINDS } from './commercial-context.loader';
import type { CheckoutQuote } from './commercial-checkout.service';
import { checkoutLineId, checkoutPieceId } from './commercial-checkout.service';
import {
  buildCommercialChildRows,
  lineMoneyColumns,
  orderSnapshotColumns,
  type ChargeMeta,
  type CommercialChildRows,
  type LineMoneyColumns,
} from './commercial-line.writer';

const PRICED_SYS_KINDS = PRICED_PREFERENCE_SYS_KINDS;

/** Where a preference row hangs: the order, a line or a piece (by the quote's ids). */
type PreferenceScope = string;
const ORDER_SCOPE: PreferenceScope = 'order';
const prefKey = (scope: PreferenceScope, kind: string, code: string) => `${scope}|${kind}|${code}`;

/** The money and id bookkeeping of one Create call. */
export interface CommercialCreateSession {
  /** `org_orders_mst` snapshot columns (§5.3), `ready_by` included. */
  orderColumns: () => ReturnType<typeof orderSnapshotColumns>;
  /** §6.1 columns of line `index` (a cashier price is MANUAL, from the line intent). */
  itemColumns: (index: number) => LineMoneyColumns;
  /** §6.1 columns of piece `pieceIndex` of line `index`. */
  pieceColumns: (index: number, pieceIndex: number) => LineMoneyColumns;
  /**
   * The server price of a preference row, by its `preference_sys_kind`;
   * null for an unpriced kind (colour, condition, note), which keeps 0.
   */
  preferencePrice: (sysKind: string, code: string) => string | null;
  recordItem: (index: number, itemId: string) => void;
  recordPiece: (index: number, pieceIndex: number, pieceId: string) => void;
  /** Records a created preference row so a charge can point at it. `index`/`pieceIndex` null: an ORDER row. */
  recordPreference: (row: { id: string; sysKind: string; code: string; index: number | null; pieceIndex: number | null }) => void;
  /** The discount, charge and tax rows, once every item, piece and preference row exists. */
  childRows: (ctx: { tenantOrgId: string; orderId: string; currencyCode: string; userId: string | null }) => CommercialChildRows;
}

/**
 * Opens the bookkeeping for one Create from its checkout quote.
 * @param checkout the quote Create was checked against (same figures the cashier saw)
 * @returns the session `createOrderInTransaction` reads money from and records ids into
 * @throws Error when Create asks for a line or piece the quote does not have, or a charge has no preference row
 */
export function openCommercialCreateSession(checkout: CheckoutQuote): CommercialCreateSession {
  const { result, prices, facts } = checkout.quote;
  const itemIds = new Map<string, string>();
  const pieceIds = new Map<string, string>();
  const preferenceIds = new Map<string, string>();

  const lineAt = (index: number) => {
    const lineId = checkoutLineId(index);
    const line = result.lines.find((l) => l.lineId === lineId);
    const price = prices.find((p) => p.lineId === lineId);
    const intent = checkout.intent.lines.find((l) => l.lineId === lineId);
    if (!line || !price || !intent) throw new Error(`The checkout quote has no line ${lineId}.`);
    return { line, price, isOverride: intent.overrideUnitPrice != null };
  };
  const scopeOf = (index: number | null, pieceIndex: number | null): PreferenceScope =>
    index == null ? ORDER_SCOPE : pieceIndex == null ? checkoutLineId(index) : checkoutPieceId(index, pieceIndex);

  return {
    orderColumns: () => orderSnapshotColumns(result, facts, prices, checkout.intent.serviceSpeed),
    itemColumns: (index) => {
      const { line, price, isOverride } = lineAt(index);
      return lineMoneyColumns(line.item, line, price, isOverride, facts.pricingMode);
    },
    pieceColumns: (index, pieceIndex) => {
      const { line, price, isOverride } = lineAt(index);
      const piece = line.pieces.find((p) => p.rowId === checkoutPieceId(index, pieceIndex));
      if (!piece) throw new Error(`The checkout quote has no piece ${checkoutPieceId(index, pieceIndex)}.`);
      return lineMoneyColumns(piece, line, price, isOverride, facts.pricingMode);
    },
    preferencePrice: (sysKind, code) => {
      const kind = PRICED_SYS_KINDS[sysKind];
      return kind ? facts.preferences.get(`${kind}:${code}`)?.amount ?? null : null;
    },
    recordItem: (index, itemId) => { itemIds.set(checkoutLineId(index), itemId); },
    recordPiece: (index, pieceIndex, pieceId) => { pieceIds.set(checkoutPieceId(index, pieceIndex), pieceId); },
    recordPreference: ({ id, sysKind, code, index, pieceIndex }) => {
      const kind = PRICED_SYS_KINDS[sysKind];
      if (kind) preferenceIds.set(prefKey(scopeOf(index, pieceIndex), kind, code), id);
    },
    childRows: ({ tenantOrgId, orderId, currencyCode, userId }) => {
      // A charge id ends with `<owner>:<kind>:<code>`: the loader names a modifier after the
      // line or piece that chose it (`order` for an order preference). At ITEM level a piece's
      // extra is charged on its line, so the owner, not `sourcePieceId`, finds its row.
      const chargeMeta = new Map<string, ChargeMeta>();
      for (const charge of result.charges) {
        const [scope, kind, code] = charge.chargeId.split(':').slice(-3);
        const sourceId = preferenceIds.get(prefKey(scope, kind, code));
        // Never write a charge that no preference row explains (an orphan inflates totals).
        if (!sourceId) throw new Error(`Charge ${charge.chargeId} has no created preference row.`);
        chargeMeta.set(charge.chargeId, { sourceId, label: code });
      }
      const taxLineMeta = new Map([...facts.taxProfileLabels].map(([id, l]) => [id, { label: l.label, label2: l.label2 }] as const));
      return buildCommercialChildRows(result, {
        tenantOrgId, orderId, currencyCode, userId, itemIds, pieceIds,
        adjustmentMeta: checkout.adjustmentMeta, chargeMeta, taxLineMeta,
      });
    },
  };
}
