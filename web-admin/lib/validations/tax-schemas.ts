/** Boundary validation for the /api/v1/tax routes. Enum values come from the DB-mirror constants. */
import { z } from 'zod'
import {
  TAX_AMOUNT_KINDS,
  TAX_CALC_LEVELS,
  TAX_CLASS_FLOWS,
  TAX_EMIRATES,
  TAX_FLOWS,
  TAX_PARTY_SCOPES,
  TAX_SETUP_MODES,
} from '@/lib/constants/tax'
import { CMX_DEFAULT_PAGE_SIZE } from '@ui/data-display/cmx-table-defaults'

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,30}$/)
const optionalText = z.string().trim().max(250).nullable()
const criterion = z.string().trim().min(1).nullable()

export const taxListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  flow: z.enum(TAX_FLOWS).optional(),
  includeInactive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(CMX_DEFAULT_PAGE_SIZE),
})

const taxCodeFields = z.object({
  name: z.string().trim().min(1).max(250),
  name2: optionalText,
  taxType: z.string().trim().min(1),
  amountKind: z.enum(TAX_AMOUNT_KINDS),
  rate: z.number().min(0).max(100).nullable(),
  fixedAmount: z.number().min(0).nullable(),
  calcLevel: z.enum(TAX_CALC_LEVELS),
  taxCategoryCode: z.string().trim().min(1),
  exemptReasonCode: z.string().trim().min(1).nullable(),
  taxFlowCode: z.enum(TAX_FLOWS),
  recoverablePct: z.number().min(0).max(100),
  isReverseCharge: z.boolean(),
  priority: z.number().int().min(1).max(999),
  effectiveFrom: isoDay,
  effectiveTo: isoDay.nullable(),
})

/** Mirrors ck_otp_amount and ck_otp_vat_line, so the user gets a field error, not a database one. */
function amountIsCoherent(v: { amountKind?: string; rate?: number | null; fixedAmount?: number | null; taxType?: string; calcLevel?: string }): boolean {
  if (v.amountKind === 'PERCENT' && v.fixedAmount != null) return false
  if (v.amountKind === 'FIXED' && (v.rate != null || v.fixedAmount == null)) return false
  if (v.taxType === 'VAT' && v.calcLevel === 'DOCUMENT') return false
  return true
}

export const taxCodeCreateSchema = taxCodeFields.extend({ taxCode: code }).refine(amountIsCoherent, { message: 'TAX_CODE_AMOUNT_INVALID' })
export const taxCodePatchSchema = taxCodeFields.partial().extend({ isActive: z.boolean().optional() }).refine(amountIsCoherent, { message: 'TAX_CODE_AMOUNT_INVALID' })

const taxClassFields = z.object({
  name: z.string().trim().min(1).max(250),
  name2: optionalText,
  description: optionalText,
  description2: optionalText,
  isDefault: z.boolean(),
})
export const taxClassCreateSchema = taxClassFields.extend({ classCode: code, taxFlowCode: z.enum(TAX_CLASS_FLOWS) })
export const taxClassPatchSchema = taxClassFields.partial().extend({ isActive: z.boolean().optional() })

const taxRuleFields = z.object({
  name: z.string().trim().min(1).max(250),
  name2: optionalText,
  docTypeCode: criterion,
  taxFlowCode: z.enum(TAX_FLOWS).nullable(),
  branchId: z.string().uuid().nullable(),
  placeOfSupplyCountry: criterion,
  taxItemClassCode: criterion,
  partyTaxClassCode: criterion,
  partyCountryScope: z.enum(TAX_PARTY_SCOPES).nullable(),
  serviceCategoryCode: criterion,
  effectiveFrom: isoDay,
  effectiveTo: isoDay.nullable(),
  priority: z.number().int().min(1).max(9999),
  taxCodes: z.array(z.string().trim().min(1)).min(1).refine((c) => new Set(c).size === c.length, { message: 'TAX_RULE_DUPLICATE_CODE' }),
})
export const taxRuleCreateSchema = taxRuleFields.extend({ ruleCode: code })
export const taxRulePatchSchema = taxRuleFields.partial().extend({ isActive: z.boolean().optional() })

export const taxConfigUpdateSchema = z.object({
  setupMode: z.enum(TAX_SETUP_MODES).optional(),
  taxEnabled: z.boolean().optional(),
  orgRegistrationNo: z.string().trim().max(50).nullable().optional(),
  registrations: z
    .array(
      z.object({
        branchId: z.string().uuid(),
        taxRegistrationNo: z.string().trim().max(50).nullable(),
        emirateCode: z.enum(TAX_EMIRATES).nullable(),
      }),
    )
    .max(500)
    .optional(),
})

export const taxConfirmSchema = z.object({ note: z.string().trim().max(500).optional() })

export const taxKitApplySchema = z.object({
  pkgCode: z.string().trim().min(1),
  activate: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
})

export const taxExplainSchema = z.object({
  doc_type_code: criterion,
  tax_flow_code: z.enum(TAX_FLOWS),
  branch_id: z.string().uuid().nullable(),
  place_of_supply_country: criterion,
  tax_item_class_code: criterion,
  party_tax_class_code: criterion,
  party_country_scope: z.enum(TAX_PARTY_SCOPES).nullable(),
  service_category_code: criterion,
  date: isoDay,
})
