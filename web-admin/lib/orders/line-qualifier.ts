/**
 * Line qualifier: the short tail that tells apart order lines of one product on customer-facing documents
 * ("Rug · 2.5 m (1)", "Sweater · Express"). Shared by receipts, prints, the money view, tracking and the
 * customer app, so the measure and the speed are never worked out (or shown) twice.
 *
 * Why: a product can have several lines in one order (Order Cart Line Grouping), and a measured line must show
 * what was measured. Two rows with the same name and different amounts confuse customers.
 *
 * Pure and structured: the helper returns parts, never text. Each renderer formats them in its own language.
 * It decides nothing about money.
 * @module orders
 */

/** What the helper reads from one stored order line. */
export interface OrderLineQualifierInput {
  /** The stored line id (the result is keyed by it). */
  id: string;
  /** Catalog product; lines of different products never share an ordinal. */
  productId: string | null;
  /** The unit snapshot on the line (`uom_*`). A COUNT unit carries no measure. */
  uomCode?: string | null;
  uomDimension?: string | null;
  uomSymbol?: string | null;
  uomSymbol2?: string | null;
  uomQtyDecimals?: number | null;
  /** Measured and billed quantity as stored (decimal strings or numbers). */
  measuredQty?: string | number | null;
  billedQty?: string | number | null;
  /** The line's own speed code (`service_speed`). */
  speedCode?: string | null;
}

/** The measure part: what was measured and the unit facts to format it. */
export interface LineQualifierMeasure {
  qty: string;
  billedQty: string | null;
  uomCode: string;
  symbol: string;
  symbol2: string | null;
  qtyDecimals: number;
}

/** The parts to show after a line's name; an absent part is not shown. */
export interface LineQualifier {
  /** Measured lines only (always when measured). */
  measure?: LineQualifierMeasure;
  /** Only when the line's speed differs from the order's. */
  speedCode?: string;
  /** The speed's catalog names when the caller passed them (else renderers fall back to the code). */
  speedName?: { name: string; name2: string | null };
  /** Only when the product has 2+ lines whose other parts are identical; 1-based, in line order. */
  ordinal?: number;
}

const COUNT_DIMENSION = 'COUNT';

/** The measure is shown for a measured unit that has a stored measure. */
function measureOf(line: OrderLineQualifierInput): LineQualifierMeasure | undefined {
  if (!line.uomDimension || line.uomDimension === COUNT_DIMENSION) return undefined;
  if (line.measuredQty == null || line.measuredQty === '' || !line.uomCode) return undefined;
  return {
    qty: String(line.measuredQty),
    billedQty: line.billedQty == null || line.billedQty === '' ? null : String(line.billedQty),
    uomCode: line.uomCode,
    symbol: line.uomSymbol ?? line.uomCode,
    symbol2: line.uomSymbol2 ?? null,
    qtyDecimals: line.uomQtyDecimals ?? 3,
  };
}

/** `2.5`, `2.500000` and `2.50` are the same number; compare as numbers, not text. */
const num = (value: string): string => String(Number(value));

/** Key of the parts that tell lines apart; lines with the same key need an ordinal. */
function partsKey(line: OrderLineQualifierInput, measure: LineQualifierMeasure | undefined, speedCode: string | undefined): string {
  return [line.productId ?? `line:${line.id}`, measure ? `${measure.uomCode}:${num(measure.qty)}` : '', speedCode ?? ''].join('|');
}

/**
 * The qualifier of every line of one order.
 * @param lines the stored lines, in order (the ordinal follows this order)
 * @param orderSpeed the order's speed code; a line speed equal to it is not shown
 * @param speedNames optional catalog names by speed code (`sys_service_speed_cd`), so renderers can say "Express"
 * @returns per line id, its parts; a line with nothing to say maps to `{}`
 * @example
 * orderLineQualifiers([
 *   { id: 'a', productId: 'rug', uomCode: 'M2', uomDimension: 'AREA', measuredQty: '2.5', speedCode: 'STANDARD' },
 *   { id: 'b', productId: 'rug', uomCode: 'M2', uomDimension: 'AREA', measuredQty: '2.5', speedCode: 'STANDARD' },
 * ], 'STANDARD').get('b'); // { measure: {...}, ordinal: 2 }
 */
export function orderLineQualifiers(
  lines: readonly OrderLineQualifierInput[],
  orderSpeed: string | null | undefined,
  speedNames?: ReadonlyMap<string, { name: string; name2: string | null }>,
): Map<string, LineQualifier> {
  const parts = lines.map((line) => {
    const measure = measureOf(line);
    const speedCode = line.speedCode && line.speedCode !== orderSpeed ? line.speedCode : undefined;
    return { line, measure, speedCode, key: partsKey(line, measure, speedCode) };
  });
  const size = new Map<string, number>();
  for (const part of parts) size.set(part.key, (size.get(part.key) ?? 0) + 1);

  const seen = new Map<string, number>();
  const result = new Map<string, LineQualifier>();
  for (const { line, measure, speedCode, key } of parts) {
    const qualifier: LineQualifier = {};
    if (measure) qualifier.measure = measure;
    if (speedCode) {
      qualifier.speedCode = speedCode;
      const names = speedNames?.get(speedCode);
      if (names) qualifier.speedName = { name: names.name, name2: names.name2 };
    }
    // Only a product that has 2+ lines can have lines that look the same; a product-less line never does.
    if (line.productId && (size.get(key) ?? 0) > 1) {
      const next = (seen.get(key) ?? 0) + 1;
      seen.set(key, next);
      qualifier.ordinal = next;
    }
    result.set(line.id, qualifier);
  }
  return result;
}

/** The stored columns of one `org_order_items_dtl` row this helper reads (Prisma Decimals and strings both work). */
export interface OrderItemQualifierRow {
  id: string;
  product_id: string | null;
  uom_code?: string | null;
  uom_dimension?: string | null;
  uom_symbol?: string | null;
  uom_symbol2?: string | null;
  uom_qty_decimals?: number | null;
  measured_qty?: { toString(): string } | string | number | null;
  billed_qty?: { toString(): string } | string | number | null;
  service_speed?: string | null;
}

/**
 * Maps a stored order-item row to the helper's input, so every server surface reads the same columns the same way.
 * @param row the item row with the `uom_*`, `measured_qty`, `billed_qty` and `service_speed` columns
 * @returns the helper input
 */
export function qualifierInputOfRow(row: OrderItemQualifierRow): OrderLineQualifierInput {
  const text = (v: OrderItemQualifierRow['measured_qty']) => (v == null ? null : v.toString());
  return {
    id: row.id,
    productId: row.product_id,
    uomCode: row.uom_code,
    uomDimension: row.uom_dimension,
    uomSymbol: row.uom_symbol,
    uomSymbol2: row.uom_symbol2,
    uomQtyDecimals: row.uom_qty_decimals,
    measuredQty: text(row.measured_qty),
    billedQty: text(row.billed_qty),
    speedCode: row.service_speed,
  };
}
