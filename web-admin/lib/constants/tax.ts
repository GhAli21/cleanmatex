/** Tax engine codes. Every value mirrors a DB CHECK constraint from migration 0718. */
export const TAX_FLOWS = ['OUTPUT', 'INPUT', 'WITHHOLDING'] as const
export type TaxFlow = (typeof TAX_FLOWS)[number]

/** Item classes exist for sales and purchases only (ck_otic_flow). */
export const TAX_CLASS_FLOWS = ['OUTPUT', 'INPUT'] as const
export type TaxClassFlow = (typeof TAX_CLASS_FLOWS)[number]

export const TAX_AMOUNT_KINDS = ['PERCENT', 'FIXED'] as const
export type TaxAmountKind = (typeof TAX_AMOUNT_KINDS)[number]

export const TAX_CALC_LEVELS = ['LINE', 'DOCUMENT'] as const
export type TaxCalcLevel = (typeof TAX_CALC_LEVELS)[number]

export const TAX_SETUP_MODES = ['BASIC', 'ADVANCED'] as const
export type TaxSetupMode = (typeof TAX_SETUP_MODES)[number]

export const TAX_CONFIG_STATUS = {
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const
export type TaxConfigStatus = (typeof TAX_CONFIG_STATUS)[keyof typeof TAX_CONFIG_STATUS]

export const TAX_PARTY_SCOPES = ['DOMESTIC', 'GCC', 'FOREIGN'] as const
export type TaxPartyScope = (typeof TAX_PARTY_SCOPES)[number]

export const TAX_ROW_SOURCE = { HQ_KIT: 'HQ_KIT', TENANT: 'TENANT' } as const
export type TaxRowSource = (typeof TAX_ROW_SOURCE)[keyof typeof TAX_ROW_SOURCE]

/** UAE emirates (CHECK on org_branches_mst.emirate_code); needed for return boxes 1a–1g. */
export const TAX_EMIRATES = ['AZ', 'DU', 'SH', 'AJ', 'UQ', 'RK', 'FU'] as const
export type TaxEmirate = (typeof TAX_EMIRATES)[number]

/** Readiness codes returned by fn_tax_config_confirm. */
export const TAX_READINESS_CODES = [
  'TAX_RATE_MISSING',
  'TAX_NO_SALES_RULE',
  'TAX_REGISTRATION_MISSING',
  'TAX_EMIRATE_MISSING',
  'TAX_PRODUCT_CLASS_MISSING',
] as const
export type TaxReadinessCode = (typeof TAX_READINESS_CODES)[number]
