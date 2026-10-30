/**
 * Tax per row (ADR-060 §6, PLAN.md §8.1 steps 9–10, §8.2, §9, L14, L22).
 *
 * Why: today one tax figure is computed for the whole order, an exemption on
 * any line exempts the whole order (PF-05), and `applies_to` is never read
 * (PF-06). Here every row (an item, a piece, or a taxed charge) gets its own
 * category, profiles, taxable base and tax, and the header is built from the
 * rows, so tax documents can carry item lines (ZATCA / PINT OM).
 *
 * Kept from today's engine (`tax-engine.service.ts`): all default profiles
 * stack; compound profiles run after the others on base + prior tax; under
 * TAX_INCLUSIVE the tax is extracted from the price with the combined rate.
 *
 * Rounding (L22): exact decimals throughout; each stored tax figure is
 * rounded once by its profile's rule. `LINE`: round per row, the header is
 * the sum. `DOCUMENT` (seeded): round once per profile on the group total,
 * then split it to rows exactly (largest remainder).
 */
import {
  TAX_CATEGORIES,
  TAX_EXEMPT_REASONS,
  TAX_ROUNDING_LEVELS,
  type TaxRoundingLevel,
} from '@/lib/constants/commercial';
import { TAX_PRICING_MODES, type TaxPricingMode } from '@/lib/constants/order-financial';
import { allocateLargestRemainder } from './allocation';
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from './errors';
import { MoneyDecimal, ZERO, sumMoney, toMoney, type Money, type MoneyInput } from './money';
import { roundMoney, type RoundingRule } from './rounding';

// ─── Profiles ──────────────────────────────────────────────────────────────

/** One active, effective `org_tax_profiles_cf` row, with its rounding already resolved by the loader. */
export interface TaxProfileInput {
  /** Profile id; for the tenant-rate fallback, any stable id (the writer stores NULL). */
  id: string;
  /** `VAT`, `CUSTOM`, … carried through to the header tax line. */
  taxType: string;
  /** Percent, e.g. 15 for 15%. */
  ratePercent: MoneyInput;
  isCompound: boolean;
  isDefault: boolean;
  /** Supply codes this profile applies to; NULL or empty means a default for every line. */
  appliesTo: readonly string[] | null;
  roundingLevel: TaxRoundingLevel;
  /** Profile mode + decimals/increment, falling back to the currency ACCOUNTING rule. */
  rounding: RoundingRule;
  /**
   * True for the profile the loader builds from the tenant VAT rate when the
   * tenant has no profile at all (today's fallback). Never used for an
   * exempt row (PF-04). Written with `tax_profile_id` NULL.
   */
  isTenantRateFallback?: boolean;
}

const isGeneral = (profile: TaxProfileInput) => !profile.appliesTo || profile.appliesTo.length === 0;

/**
 * Chooses the profiles for a row (ADR-060 §6).
 *
 * A row with a supply code gets the profiles that list that code; those
 * replace the defaults (an `EXEMPT_SERVICE` line must not also carry the
 * standard VAT). A row with no supply code, or a code no profile lists, gets
 * the defaults. Order: non-compound first, then compound, each in input order
 * (the loader passes profiles by `created_at`, as today).
 * @param profiles the tenant's active, effective profiles in `created_at` order
 * @param supplyCode the product's `tax_supply_code`, or null
 * @returns the profiles to apply, in calculation order
 */
export function selectTaxProfiles(
  profiles: readonly TaxProfileInput[],
  supplyCode: string | null,
): TaxProfileInput[] {
  const special = supplyCode
    ? profiles.filter((p) => !isGeneral(p) && p.appliesTo!.includes(supplyCode))
    : [];
  const chosen = special.length > 0 ? special : profiles.filter((p) => p.isDefault && isGeneral(p));
  return [...chosen.filter((p) => !p.isCompound), ...chosen.filter((p) => p.isCompound)];
}

// ─── Category ──────────────────────────────────────────────────────────────

/** Facts the loader gathers to decide a row's tax category. */
export interface TaxCategoryInput {
  /** `org_product_data_mst.tax_category_code`; null (custom item) means STANDARD. */
  productCategory: string | null;
  /** `org_product_data_mst.tax_exempt_reason`, carried through for a non-standard product. */
  productExemptReason: string | null;
  /** The customer holds an active exemption on the business date. */
  customerExempt: boolean;
  /** This row's service type holds an active exemption on the business date. */
  serviceExempt: boolean;
}

/**
 * Decides a row's tax category and reason: customer exemption, then the
 * row's service exemption (per line, PF-05), then the product's category.
 * @param input the row's product category and exemption facts
 * @returns the category code and the reason (null for STANDARD)
 */
export function resolveTaxCategory(input: TaxCategoryInput): { category: string; exemptReason: string | null } {
  if (input.customerExempt) return { category: TAX_CATEGORIES.EXEMPT, exemptReason: TAX_EXEMPT_REASONS.CUSTOMER_EXEMPTION };
  if (input.serviceExempt) return { category: TAX_CATEGORIES.EXEMPT, exemptReason: TAX_EXEMPT_REASONS.SERVICE_EXEMPTION };
  const category = input.productCategory ?? TAX_CATEGORIES.STANDARD;
  if (category === TAX_CATEGORIES.STANDARD) return { category, exemptReason: null };
  return { category, exemptReason: input.productExemptReason ?? TAX_EXEMPT_REASONS.PRODUCT_EXEMPT };
}

// ─── Calculation ───────────────────────────────────────────────────────────

/** One taxed row: an item, a piece, or a charge with a category. */
export interface TaxRowInput {
  rowId: string;
  /** Net after line and allocated order discounts; tax-inclusive under TAX_INCLUSIVE. */
  netAmount: MoneyInput;
  taxCategoryCode: string;
  exemptReason: string | null;
  /** From `selectTaxProfiles`; ignored for a non-STANDARD category. */
  profiles: readonly TaxProfileInput[];
}

/** The order's rows and how to tax them. */
export interface TaxCalculationInput {
  /** Rows in allocation tie-break order. */
  rows: readonly TaxRowInput[];
  /** The order's `tax_pricing_mode` snapshot; every row has it (I6). */
  pricingMode: TaxPricingMode;
  /** `DOCUMENT_LEVEL` order-discount allowance per category (`applyDocumentAdjustments(...).categoryShares`). */
  documentAllowances?: ReadonlyMap<string, MoneyInput>;
  /** Currency decimals, for splitting an allowance across profile groups. */
  currencyDecimalPlaces: number;
}

/** One profile's tax inside a row. */
export interface RowProfileTax {
  profileId: string;
  amount: Money;
}

/** A row's tax figures; names follow the §6.1 columns. */
export interface TaxRowResult {
  taxCategoryCode: string;
  exemptReason: string | null;
  /** `tax_profile_id`: the first real profile applied, or null (none, or the tenant-rate fallback). */
  taxProfileId: string | null;
  /** `tax_rate`: the combined effective rate, percent, 2 decimals (`NUMERIC(5,2)`). */
  taxRate: Money;
  taxableAmount: Money;
  taxAmount: Money;
  /** I5: net + tax (exclusive) or net (inclusive). */
  lineTotalAmount: Money;
  profileTaxes: RowProfileTax[];
}

/** One header tax line per profile (`org_order_taxes_dtl`). */
export interface TaxLineResult {
  profileId: string;
  isTenantRateFallback: boolean;
  taxType: string;
  ratePercent: Money;
  isCompound: boolean;
  /** The base this profile taxed on the document, after any allowance. */
  taxableAmount: Money;
  taxAmount: Money;
}

/** Row taxes, header tax lines and the header category buckets. */
export interface TaxCalculationResult {
  rows: Map<string, TaxRowResult>;
  taxLines: TaxLineResult[];
  /** Σ row tax. */
  lineTaxTotal: Money;
  /** Σ header tax lines. Differs from `lineTaxTotal` only by the tax effect of a DOCUMENT_LEVEL allowance (I3). */
  documentTaxTotal: Money;
  /** Taxable amount per category after allowances, for the header buckets (`exempt_amount`, …). */
  categoryTaxable: Map<string, Money>;
}

const fraction = (profile: TaxProfileInput) => toMoney(profile.ratePercent).dividedBy(100);

/** Combined fraction K, so that gross = taxable × (1 + K). */
function combinedFraction(profiles: readonly TaxProfileInput[]): Money {
  let prior = ZERO;
  for (const profile of profiles) {
    const share = profile.isCompound ? prior.plus(1).times(fraction(profile)) : fraction(profile);
    prior = prior.plus(share);
  }
  return prior;
}

/** Exact tax per profile on an exact taxable amount; compound profiles tax base + prior tax. */
function profileTaxes(taxable: Money, profiles: readonly TaxProfileInput[]): Money[] {
  let prior = ZERO;
  return profiles.map((profile) => {
    const tax = (profile.isCompound ? taxable.plus(prior) : taxable).times(fraction(profile));
    prior = prior.plus(tax);
    return tax;
  });
}

interface TaxGroup {
  key: string;
  category: string;
  profiles: readonly TaxProfileInput[];
  rowIndexes: number[];
}

const fail = (code: keyof typeof COMMERCIAL_ERROR_CODES, message: string, details: Record<string, string> = {}) =>
  new CommercialRuleError(COMMERCIAL_ERROR_CODES[code], message, details);

/**
 * Taxes every row and builds the header tax lines.
 * @param input rows (net, category, profiles), pricing mode, DOCUMENT_LEVEL allowances, currency decimals
 * @returns row figures, header tax lines, totals and the category buckets
 * @throws CommercialRuleError INVALID_ADJUSTMENT on a negative net or rate; DOCUMENT_DISCOUNT_EXCEEDS_BASE on an allowance above its category
 * @example
 * calculateTax({ rows: [{ rowId: 'L1', netAmount: '10', taxCategoryCode: 'STANDARD', exemptReason: null,
 *   profiles: [vat15] }], pricingMode: 'TAX_EXCLUSIVE', currencyDecimalPlaces: 2 }).rows.get('L1')?.taxAmount.toString(); // '1.5'
 */
export function calculateTax(input: TaxCalculationInput): TaxCalculationResult {
  const inclusive = input.pricingMode === TAX_PRICING_MODES.TAX_INCLUSIVE;
  const nets = input.rows.map((row) => toMoney(row.netAmount));
  input.rows.forEach((row, i) => {
    if (nets[i].isNegative()) throw fail('INVALID_ADJUSTMENT', `Row ${row.rowId} has a negative net.`, { rowId: row.rowId });
    row.profiles.forEach((p) => {
      if (toMoney(p.ratePercent).isNegative()) throw fail('INVALID_ADJUSTMENT', `Tax profile ${p.id} has a negative rate.`, { profileId: p.id });
    });
  });

  // ─── Group rows that are taxed the same way ────────────────────────────
  const groups = new Map<string, TaxGroup>();
  input.rows.forEach((row, i) => {
    const profiles = row.taxCategoryCode === TAX_CATEGORIES.STANDARD ? row.profiles : [];
    const key = `${row.taxCategoryCode}|${profiles.map((p) => p.id).join(',')}`;
    const group = groups.get(key) ?? { key, category: row.taxCategoryCode, profiles, rowIndexes: [] };
    group.rowIndexes.push(i);
    groups.set(key, group);
  });
  const groupList = [...groups.values()];
  const groupBase = (g: TaxGroup) => sumMoney(g.rowIndexes.map((i) => nets[i]));

  // ─── Split each category's allowance across its groups ─────────────────
  const allowanceByGroup = new Map<string, Money>();
  for (const [category, raw] of input.documentAllowances ?? []) {
    const allowance = toMoney(raw);
    if (allowance.isZero()) continue;
    const inCategory = groupList.filter((g) => g.category === category);
    const base = sumMoney(inCategory.map(groupBase));
    if (inCategory.length === 0 || allowance.greaterThan(base)) {
      throw fail('DOCUMENT_DISCOUNT_EXCEEDS_BASE', `The ${category} allowance ${allowance.toString()} is more than its base ${base.toString()}.`,
        { category, allowance: allowance.toString(), base: base.toString() });
    }
    const shares = allocateLargestRemainder(allowance, inCategory.map(groupBase), input.currencyDecimalPlaces);
    inCategory.forEach((g, i) => allowanceByGroup.set(g.key, shares[i]));
  }

  // ─── Tax per group ─────────────────────────────────────────────────────
  const rowTaxes: Money[][] = input.rows.map(() => []);
  const rowProfiles: (readonly TaxProfileInput[])[] = input.rows.map(() => []);
  const taxLines = new Map<string, TaxLineResult>();
  const categoryTaxable = new Map<string, Money>();
  const addCategory = (category: string, amount: Money) =>
    categoryTaxable.set(category, (categoryTaxable.get(category) ?? ZERO).plus(amount));

  for (const group of groupList) {
    const allowance = allowanceByGroup.get(group.key) ?? ZERO;
    const docNet = groupBase(group).minus(allowance);
    const { profiles } = group;
    if (profiles.length === 0) {
      addCategory(group.category, docNet);
      continue;
    }
    const divisor = inclusive ? combinedFraction(profiles).plus(1) : new MoneyDecimal(1);
    const taxableOf = (net: Money) => net.dividedBy(divisor);
    const exactByRow = group.rowIndexes.map((i) => profileTaxes(taxableOf(nets[i]), profiles));
    const exactGroup = profileTaxes(taxableOf(groupBase(group)), profiles);
    const exactAllowance = profileTaxes(taxableOf(allowance), profiles);

    let docTaxSoFar = ZERO;
    profiles.forEach((profile, p) => {
      const round = (value: Money) => roundMoney(value, profile.rounding);
      let rowAmounts: Money[];
      let header: Money;
      if (profile.roundingLevel === TAX_ROUNDING_LEVELS.LINE) {
        rowAmounts = exactByRow.map((taxes) => round(taxes[p]));
        header = sumMoney(rowAmounts).minus(round(exactAllowance[p]));
      } else {
        rowAmounts = allocateLargestRemainder(
          round(exactGroup[p]), exactByRow.map((taxes) => taxes[p]), profile.rounding.decimalPlaces,
        );
        header = round(exactGroup[p].minus(exactAllowance[p]));
      }
      group.rowIndexes.forEach((i, k) => {
        rowTaxes[i].push(rowAmounts[k]);
        rowProfiles[i] = profiles;
      });

      // The base this profile taxed on the document: the taxable part of the
      // document net (inclusive: net − all header taxes), plus prior tax if compound.
      const line = taxLines.get(profile.id) ?? {
        profileId: profile.id,
        isTenantRateFallback: profile.isTenantRateFallback === true,
        taxType: profile.taxType,
        ratePercent: toMoney(profile.ratePercent),
        isCompound: profile.isCompound,
        taxableAmount: ZERO,
        taxAmount: ZERO,
      };
      line.taxAmount = line.taxAmount.plus(header);
      line.taxableAmount = line.taxableAmount.plus(profile.isCompound ? docTaxSoFar : ZERO);
      docTaxSoFar = docTaxSoFar.plus(header);
      taxLines.set(profile.id, line);
    });

    const docTaxable = inclusive ? docNet.minus(docTaxSoFar) : docNet;
    profiles.forEach((profile) => {
      const line = taxLines.get(profile.id)!;
      line.taxableAmount = line.taxableAmount.plus(docTaxable);
    });
    addCategory(group.category, docTaxable);
  }

  // ─── Row results ───────────────────────────────────────────────────────
  const rows = new Map<string, TaxRowResult>();
  input.rows.forEach((row, i) => {
    const profiles = rowProfiles[i];
    const taxAmount = sumMoney(rowTaxes[i]);
    const net = nets[i];
    const real = profiles.find((p) => !p.isTenantRateFallback);
    rows.set(row.rowId, {
      taxCategoryCode: row.taxCategoryCode,
      exemptReason: row.exemptReason,
      taxProfileId: real?.id ?? null,
      taxRate: roundMoney(combinedFraction(profiles).times(100), { decimalPlaces: 2, mode: 'HALF_UP' }),
      taxableAmount: inclusive ? net.minus(taxAmount) : net,
      taxAmount,
      lineTotalAmount: inclusive ? net : net.plus(taxAmount),
      profileTaxes: profiles.map((p, k) => ({ profileId: p.id, amount: rowTaxes[i][k] })),
    });
  });

  const lines = [...taxLines.values()];
  return {
    rows,
    taxLines: lines,
    lineTaxTotal: sumMoney([...rows.values()].map((r) => r.taxAmount)),
    documentTaxTotal: sumMoney(lines.map((l) => l.taxAmount)),
    categoryTaxable,
  };
}
