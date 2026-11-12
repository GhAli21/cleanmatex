/** API shapes of the /api/v1/tax routes, as the browser receives them (decimals arrive as strings). */
import type { TaxConfigStatus, TaxEmirate, TaxReadinessCode, TaxSetupMode } from '@/lib/constants/tax'

export interface TaxBranch {
  id: string
  name: string | null
  name2: string | null
  branch_name: string | null
  country: string | null
  tax_registration_no: string | null
  emirate_code: TaxEmirate | null
}

export interface TaxConfigView {
  config: {
    starter_pkg_code: string
    kit_code: string
    segment_code: string
    setup_mode: TaxSetupMode
    status: TaxConfigStatus
    tax_enabled: boolean
    confirmed_at: string | null
    last_apply_summary: { conflicts?: { kind: string; code: string; reason: string }[] } | null
  } | null
  tenant: { country: string | null; currency: string | null; tax_registration_no: string | null; tax_pricing_mode: string } | null
  branches: TaxBranch[]
  ratesMissing: { id: string; tax_code: string; name: string; name2: string | null; version_no: number }[]
  counts: { codes: number; rules: number; classes: number } | null
  kit: {
    name: string
    name2: string | null
    kit_kind: string
    version: { version_no: number; is_verified: boolean; review_notes: string | null; source_url: string | null; checked_on: string | null }
  } | null
  pkg: { name: string; name2: string | null; tax_pricing_mode: string } | null
  triggers: { trigger_event: string; document_type: string }[]
  examples: { vector_code: string; description: string; description2: string | null; expected: Record<string, unknown> }[]
}

export interface TaxPackage {
  pkg_code: string
  name: string
  name2: string | null
  description: string | null
  description2: string | null
  country_code: string | null
  segment_code: string
  tax_kit_code: string
  is_country_default: boolean
}

export interface TaxOptions {
  taxTypes: { tax_type: string; name: string; name2: string | null }[]
  categories: { code: string; name: string; name2: string | null }[]
  exemptReasons: { code: string; name: string; name2: string | null }[]
  docTypes: { doc_type_code: string; tax_flow_code: string; name: string; name2: string | null }[]
  partyClasses: { party_class_code: string; name: string; name2: string | null }[]
  countries: { code: string; name: string; name2: string | null }[]
  serviceCategories: { service_category_code: string; ctg_name: string; ctg_name2: string | null }[]
  branches: { id: string; branch_name: string | null; name: string | null; name2: string | null }[]
  classes: { class_code: string; tax_flow_code: string; is_default: boolean; name: string; name2: string | null }[]
  codes: { tax_code: string; tax_flow_code: string; name: string; name2: string | null }[]
}

export interface TaxCodeRow {
  id: string
  tax_code: string
  version_no: number
  name: string
  name2: string | null
  tax_type: string
  amount_kind: 'PERCENT' | 'FIXED'
  rate: string | null
  fixed_amount: string | null
  calc_level: 'LINE' | 'DOCUMENT'
  tax_category_code: string
  exempt_reason_code: string | null
  tax_flow_code: 'OUTPUT' | 'INPUT' | 'WITHHOLDING'
  recoverable_pct: string
  is_reverse_charge: boolean
  priority: number
  effective_from: string
  effective_to: string | null
  source: 'HQ_KIT' | 'TENANT'
  is_tenant_modified: boolean
  is_active: boolean
}

export interface TaxClassRow {
  id: string
  class_code: string
  tax_flow_code: 'OUTPUT' | 'INPUT'
  name: string
  name2: string | null
  description: string | null
  description2: string | null
  is_default: boolean
  source: 'HQ_KIT' | 'TENANT'
  is_active: boolean
}

export interface TaxRuleRow {
  id: string
  rule_code: string
  name: string
  name2: string | null
  doc_type_code: string | null
  tax_flow_code: 'OUTPUT' | 'INPUT' | 'WITHHOLDING' | null
  branch_id: string | null
  place_of_supply_country: string | null
  tax_item_class_code: string | null
  party_tax_class_code: string | null
  party_country_scope: 'DOMESTIC' | 'GCC' | 'FOREIGN' | null
  service_category_code: string | null
  effective_from: string
  effective_to: string | null
  priority: number
  source: 'HQ_KIT' | 'TENANT'
  is_active: boolean
  tax_codes: string[]
}

export interface TaxPage<T> {
  rows: T[]
  total: number
}

export interface TaxConfirmResponse {
  ok: boolean
  errors: TaxReadinessCode[]
}

export interface TaxExplainCode {
  tax_code: string
  missing: boolean
  version_no?: number
  name?: string
  name2?: string | null
  amount_kind?: string
  rate?: number | null
  fixed_amount?: number | null
  is_reverse_charge?: boolean
}

export interface TaxExplainResponse {
  status: 'MATCHED' | 'AMBIGUOUS' | 'NO_TAX_RULE'
  rule: { rule_code: string; name: string; name2: string | null } | null
  codes: TaxExplainCode[]
  candidates: { id: string; rule_code: string; name: string; name2: string | null; priority: number }[]
}

export interface TaxExplainFacts {
  doc_type_code: string | null
  tax_flow_code: 'OUTPUT' | 'INPUT' | 'WITHHOLDING'
  branch_id: string | null
  place_of_supply_country: string | null
  tax_item_class_code: string | null
  party_tax_class_code: string | null
  party_country_scope: 'DOMESTIC' | 'GCC' | 'FOREIGN' | null
  service_category_code: string | null
  date: string
}

export type TaxPartyScopeValue = TaxExplainFacts['party_country_scope']

/** A tax return period (`/api/v1/tax/periods`). */
export interface TaxPeriodRow {
  id: string
  periodStart: string
  periodEnd: string
  status: 'OPEN' | 'CLOSED'
  closedAt: string | null
  closedBy: string | null
  reopenedAt: string | null
  reopenReason: string | null
}

/** One box of the VAT return; amounts are decimal strings in the organization currency. */
export interface TaxReturnBoxRow {
  code: string
  section: 'SALES' | 'PURCHASES' | 'NET'
  kind: 'LINES' | 'TOTAL' | 'MANUAL'
  name: string
  name2: string | null
  showsAmount: boolean
  showsTax: boolean
  isVerified: boolean
  amount: string
  tax: string
}

export interface TaxReturnView {
  kitCode: string | null
  from: string
  to: string
  currencyCode: string | null
  currencyDecimals: number | null
  boxes: TaxReturnBoxRow[]
  notOnReturn: { flow: string; category: string; reverseCharge: boolean; emirate: string | null; taxable: string; tax: string; lineCount: number }[]
  lineCount: number
}

export interface TaxReturnLineRow {
  id: string
  tax_date: string
  source_doc_type_code: string
  source_doc_no: string | null
  tax_code: string
  rate: string | null
  taxable: string
  tax: string
  recoverable: string
  is_reversal: boolean
}
