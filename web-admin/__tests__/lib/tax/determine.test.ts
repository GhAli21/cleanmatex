import { determineTaxRule, findTaxRuleConflict, pickTaxCodeVersion, type TaxFacts, type TaxRuleForMatch } from '@/lib/tax/determine'

const none = {
  doc_type_code: null,
  tax_flow_code: null,
  branch_id: null,
  place_of_supply_country: null,
  tax_item_class_code: null,
  party_tax_class_code: null,
  party_country_scope: null,
  service_category_code: null,
}
const rule = (id: string, over: Partial<TaxRuleForMatch> = {}): TaxRuleForMatch => ({
  ...none,
  id,
  priority: 100,
  effective_from: '2026-01-01',
  effective_to: null,
  ...over,
})
const facts: TaxFacts = { ...none, tax_flow_code: 'OUTPUT', tax_item_class_code: 'STD', date: '2026-06-01' }

describe('determineTaxRule', () => {
  it('prefers the more specific rule', () => {
    const r = determineTaxRule(facts, [
      rule('flow', { tax_flow_code: 'OUTPUT', priority: 1 }),
      rule('class', { tax_flow_code: 'OUTPUT', tax_item_class_code: 'STD', priority: 200 }),
    ])
    expect(r.rule?.id).toBe('class')
  })

  it('uses the lowest priority between equally specific rules', () => {
    const r = determineTaxRule(facts, [
      rule('b', { tax_flow_code: 'OUTPUT', priority: 20 }),
      rule('a', { tax_item_class_code: 'STD', priority: 10 }),
    ])
    expect(r.rule?.id).toBe('a')
  })

  it('reports a tie instead of guessing', () => {
    const r = determineTaxRule(facts, [rule('b', { tax_flow_code: 'OUTPUT' }), rule('a', { tax_item_class_code: 'STD' })])
    expect(r.status).toBe('AMBIGUOUS')
    expect(r.rule).toBeNull()
  })

  it('reports no rule rather than zero tax', () => {
    expect(determineTaxRule(facts, [rule('x', { tax_flow_code: 'INPUT' })]).status).toBe('NO_TAX_RULE')
  })

  it('ignores rules outside their dates, with an inclusive end', () => {
    expect(determineTaxRule(facts, [rule('old', { effective_to: '2026-05-31' })]).status).toBe('NO_TAX_RULE')
    expect(determineTaxRule(facts, [rule('edge', { effective_to: '2026-06-01' })]).status).toBe('MATCHED')
    expect(determineTaxRule(facts, [rule('new', { effective_from: '2026-06-02' })]).status).toBe('NO_TAX_RULE')
  })

  it('does not let a rule with a criterion match a line missing that fact', () => {
    expect(determineTaxRule(facts, [rule('p', { party_tax_class_code: 'CONSUMER' })]).status).toBe('NO_TAX_RULE')
  })
})

describe('findTaxRuleConflict', () => {
  const candidate = rule('new', { tax_flow_code: 'OUTPUT', party_tax_class_code: 'CONSUMER' })

  it('finds overlapping rules of equal weight', () => {
    expect(findTaxRuleConflict(candidate, [rule('o', { tax_flow_code: 'OUTPUT', tax_item_class_code: 'STD' })])?.id).toBe('o')
  })

  it('allows a different priority or a different specificity', () => {
    expect(findTaxRuleConflict(candidate, [rule('o', { tax_flow_code: 'OUTPUT', tax_item_class_code: 'STD', priority: 5 })])).toBeNull()
    expect(findTaxRuleConflict(candidate, [rule('o', { tax_flow_code: 'OUTPUT' })])).toBeNull()
  })

  it('allows disjoint criteria and periods', () => {
    expect(findTaxRuleConflict(candidate, [rule('o', { tax_flow_code: 'INPUT', tax_item_class_code: 'STD' })])).toBeNull()
    expect(
      findTaxRuleConflict(candidate, [
        rule('o', { tax_flow_code: 'OUTPUT', tax_item_class_code: 'STD', effective_from: '2020-01-01', effective_to: '2020-12-31' }),
      ]),
    ).toBeNull()
  })

  it('does not conflict with itself', () => {
    expect(findTaxRuleConflict(candidate, [candidate])).toBeNull()
  })
})

describe('pickTaxCodeVersion', () => {
  const v = (version_no: number, effective_from: string, effective_to: string | null = null) => ({ version_no, effective_from, effective_to })

  it('takes the highest version in force', () => {
    const versions = [v(1, '2026-01-01', '2026-06-30'), v(2, '2026-07-01')]
    expect(pickTaxCodeVersion(versions, '2026-06-30')?.version_no).toBe(1)
    expect(pickTaxCodeVersion(versions, '2026-07-01')?.version_no).toBe(2)
    expect(pickTaxCodeVersion(versions, '2025-01-01')).toBeNull()
  })
})
