/** Fixtures for a confirmed tax setup: one catch-all sales rule charging one code. */
const FROM = new Date('2020-01-01');

/** Columns the engine reads on a tax code, for a STANDARD line percent. */
export const taxCodeColumns = (taxCode: string) => ({
  tax_code: taxCode, version_no: 1, effective_from: FROM, effective_to: null,
  amount_kind: 'PERCENT', calc_level: 'LINE', tax_category_code: 'STANDARD', exempt_reason_code: null,
});

/** The rows that turn the engine on, charging `taxCode` on every sales line. */
export const activeTaxSetup = (taxCode: string) => ({
  org_tax_config_cf: [{ status: 'ACTIVE', tax_enabled: true }],
  org_tax_item_classes_cf: [{ class_code: 'LAUNDRY_SERVICE' }],
  org_tax_rules_cf: [{
    id: 'rule-any', rule_code: 'OUT_ANY', doc_type_code: null, tax_flow_code: 'OUTPUT', branch_id: null, place_of_supply_country: null,
    tax_item_class_code: null, party_tax_class_code: null, party_country_scope: null, service_category_code: null,
    priority: 900, effective_from: FROM, effective_to: null,
    org_tax_rule_codes_dtl: [{ tax_code: taxCode, seq_no: 1, is_active: true }],
  }],
});

/** The model names the order loader adds for the tax engine. */
export const TAX_ENGINE_MODELS = ['org_tax_config_cf', 'org_tax_rules_cf', 'org_tax_item_classes_cf'];
