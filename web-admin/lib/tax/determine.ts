/**
 * Tax rule determination: pure, no I/O. Shared by the explain preview now and the
 * order tax calculation from T4, so both can never disagree.
 *
 * NULL criterion = any. The most specific matching rule wins, then the lowest
 * priority. Anything else is reported instead of guessed: a tie is AMBIGUOUS,
 * no match is NO_TAX_RULE (never a silent zero).
 */
export interface TaxRuleCriteria {
  doc_type_code: string | null
  tax_flow_code: string | null
  branch_id: string | null
  place_of_supply_country: string | null
  tax_item_class_code: string | null
  party_tax_class_code: string | null
  party_country_scope: string | null
  service_category_code: string | null
}

export const TAX_RULE_CRITERIA_KEYS = [
  'doc_type_code',
  'tax_flow_code',
  'branch_id',
  'place_of_supply_country',
  'tax_item_class_code',
  'party_tax_class_code',
  'party_country_scope',
  'service_category_code',
] as const satisfies readonly (keyof TaxRuleCriteria)[]

/**
 * A DATE column as ISO `YYYY-MM-DD` (DATE columns arrive as UTC midnight).
 * @param d - The stored date
 * @returns The ISO date
 */
export const isoDate = (d: Date): string => d.toISOString().slice(0, 10)

/** A rule as the engine reads it. Dates are ISO `YYYY-MM-DD`; the end date is inclusive. */
export interface TaxRuleForMatch extends TaxRuleCriteria {
  id: string
  priority: number
  effective_from: string
  effective_to: string | null
}

/** The facts of one line. A NULL fact only matches a rule that is NULL there too. */
export type TaxFacts = TaxRuleCriteria & { date: string }

export type TaxDetermination<R extends TaxRuleForMatch> =
  | { status: 'MATCHED'; rule: R; candidates: R[] }
  | { status: 'AMBIGUOUS'; rule: null; candidates: R[] }
  | { status: 'NO_TAX_RULE'; rule: null; candidates: R[] }

/**
 * Counts the criteria a rule fixes; more means more specific.
 * @param rule - The rule
 * @returns Number of non-NULL criteria
 */
export function ruleSpecificity(rule: TaxRuleCriteria): number {
  return TAX_RULE_CRITERIA_KEYS.filter((k) => rule[k] !== null).length
}

function coversDate(rule: TaxRuleForMatch, date: string): boolean {
  return rule.effective_from <= date && (rule.effective_to === null || date <= rule.effective_to)
}

/**
 * Picks the rule for one line.
 * @param facts - The line's facts
 * @param rules - The organization's active rules
 * @returns The outcome, with every matching rule, best first, for the explanation
 */
export function determineTaxRule<R extends TaxRuleForMatch>(facts: TaxFacts, rules: R[]): TaxDetermination<R> {
  const candidates = rules
    .filter((r) => coversDate(r, facts.date) && TAX_RULE_CRITERIA_KEYS.every((k) => r[k] === null || r[k] === facts[k]))
    .sort((a, b) => ruleSpecificity(b) - ruleSpecificity(a) || a.priority - b.priority)

  const [best, next] = candidates
  if (!best) return { status: 'NO_TAX_RULE', rule: null, candidates }
  if (next && ruleSpecificity(next) === ruleSpecificity(best) && next.priority === best.priority) {
    return { status: 'AMBIGUOUS', rule: null, candidates }
  }
  return { status: 'MATCHED', rule: best, candidates }
}

function periodsOverlap(a: TaxRuleForMatch, b: TaxRuleForMatch): boolean {
  return a.effective_from <= (b.effective_to ?? '9999-12-31') && b.effective_from <= (a.effective_to ?? '9999-12-31')
}

/**
 * Save-time check: finds an existing rule that could tie with the candidate on some line.
 * Two rules can hit the same line when no criterion holds different values in both.
 * @param candidate - The rule being saved
 * @param others - The other active rules
 * @returns The first conflicting rule, or null
 */
export function findTaxRuleConflict<R extends TaxRuleForMatch>(candidate: TaxRuleForMatch, others: R[]): R | null {
  return (
    others.find(
      (o) =>
        o.id !== candidate.id &&
        o.priority === candidate.priority &&
        ruleSpecificity(o) === ruleSpecificity(candidate) &&
        periodsOverlap(o, candidate) &&
        TAX_RULE_CRITERIA_KEYS.every((k) => o[k] === null || candidate[k] === null || o[k] === candidate[k]),
    ) ?? null
  )
}

/**
 * Picks the version of a tax code in force on a date: the highest version covering it.
 * @param versions - All active versions of one code
 * @param date - ISO date
 * @returns The version, or null when none covers the date
 */
export function pickTaxCodeVersion<V extends { version_no: number; effective_from: string; effective_to: string | null }>(
  versions: V[],
  date: string,
): V | null {
  return (
    versions
      .filter((v) => v.effective_from <= date && (v.effective_to === null || date <= v.effective_to))
      .sort((a, b) => b.version_no - a.version_no)[0] ?? null
  )
}
