/** GET / POST /api/v1/tax/rules: tax rules. */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { validateCSRF } from '@/lib/middleware/csrf'
import { parseTaxBody, taxInvalid, taxResponse } from '@/lib/services/tax/tax-route'
import { createTaxRule, listTaxRules } from '@/lib/services/tax/tax-rules.service'
import { taxRuleCreateSchema, taxListQuerySchema } from '@/lib/validations/tax-schemas'
import type { TaxRuleCreate } from '@/lib/services/tax/tax-rules.service'

export async function GET(request: NextRequest) {
  const auth = await requirePermission('tax:view_config')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId } = auth
  const query = taxListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!query.success) return taxInvalid()
  return taxResponse(tenantId, () => listTaxRules(tenantId, query.data))
}

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request)
  if (csrf) return csrf
  const auth = await requirePermission('tax:manage_config')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId, userId } = auth
  const body = await parseTaxBody(request, taxRuleCreateSchema)
  if (body instanceof NextResponse) return body
  return taxResponse(tenantId, () => createTaxRule(tenantId, userId, body as TaxRuleCreate), 201)
}
