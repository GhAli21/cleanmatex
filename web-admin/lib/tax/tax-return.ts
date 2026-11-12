/**
 * VAT return arithmetic (T7): fills each return box from grouped final tax lines,
 * using the kit's box sources (sys_tax_return_box_map_dtl). Pure: no I/O.
 */
import { ZERO, toMoney, type Money } from '@/lib/commercial/money';

export interface ReturnBoxDef {
  box_code: string;
  section_code: string;
  box_kind: string;
  shows_amount: boolean;
  shows_tax: boolean;
  name: string;
  name2: string | null;
  display_order: number;
  is_verified: boolean;
}

export interface ReturnBoxSource {
  box_code: string;
  source_kind: string;
  tax_flow_code: string | null;
  tax_category_code: string | null;
  is_reverse_charge: boolean | null;
  emirate_code: string | null;
  tax_measure: string | null;
  source_box_code: string | null;
  sign: number;
}

/** Final tax lines of the range, summed by everything a box can filter on (base currency). */
export interface ReturnLineGroup {
  tax_flow_code: string;
  tax_category_code: string;
  is_reverse_charge: boolean;
  emirate_code: string | null;
  taxable: string;
  tax: string;
  recoverable: string;
  line_count: number;
}

export interface ReturnBoxValue extends ReturnBoxDef {
  amount: Money;
  tax: Money;
}

/** True when a group of lines feeds a LINES source. */
export function lineSourceMatches(s: ReturnBoxSource, g: Pick<ReturnLineGroup, 'tax_flow_code' | 'tax_category_code' | 'is_reverse_charge' | 'emirate_code'>): boolean {
  return s.source_kind === 'LINES'
    && s.tax_flow_code === g.tax_flow_code
    && (s.tax_category_code == null || s.tax_category_code === g.tax_category_code)
    && (s.is_reverse_charge == null || s.is_reverse_charge === g.is_reverse_charge)
    && (s.emirate_code == null || s.emirate_code === g.emirate_code);
}

/**
 * @param boxes - The kit's boxes
 * @param sources - Their sources
 * @param groups - Grouped final lines of the range
 * @returns Every box with its amount and tax, in form order, and the groups no box takes
 */
export function computeTaxReturn(boxes: readonly ReturnBoxDef[], sources: readonly ReturnBoxSource[], groups: readonly ReturnLineGroup[]) {
  const byBox = new Map<string, ReturnBoxSource[]>();
  for (const s of sources) byBox.set(s.box_code, [...(byBox.get(s.box_code) ?? []), s]);
  const done = new Map<string, { amount: Money; tax: Money }>();
  const visiting = new Set<string>();

  const value = (code: string): { amount: Money; tax: Money } => {
    const known = done.get(code);
    if (known) return known;
    if (visiting.has(code)) throw new Error(`TAX_RETURN_BOX_CYCLE: ${code}`);
    visiting.add(code);
    let amount = ZERO;
    let tax = ZERO;
    for (const s of byBox.get(code) ?? []) {
      if (s.source_kind === 'BOX' && s.source_box_code) {
        const v = value(s.source_box_code);
        amount = amount.plus(v.amount.times(s.sign));
        tax = tax.plus(v.tax.times(s.sign));
      } else {
        for (const g of groups.filter((x) => lineSourceMatches(s, x))) {
          amount = amount.plus(toMoney(g.taxable).times(s.sign));
          tax = tax.plus(toMoney(s.tax_measure === 'RECOVERABLE' ? g.recoverable : g.tax).times(s.sign));
        }
      }
    }
    visiting.delete(code);
    const v = { amount, tax };
    done.set(code, v);
    return v;
  };

  const values: ReturnBoxValue[] = [...boxes]
    .sort((a, b) => a.display_order - b.display_order)
    .map((b) => ({ ...b, ...value(b.box_code) }));
  const notOnReturn = groups.filter((g) => !sources.some((s) => lineSourceMatches(s, g)));
  return { boxes: values, notOnReturn };
}
