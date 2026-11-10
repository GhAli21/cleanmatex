/** POST /api/v1/tax/explain: which rule and codes apply to given facts. Saves nothing. */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { validateCSRF } from '@/lib/middleware/csrf'
import { parseTaxBody, taxResponse } from '@/lib/services/tax/tax-route'
import { explainTax } from '@/lib/services/tax/tax-explain.service'
import { taxExplainSchema } from '@/lib/validations/tax-schemas'
import type { TaxFacts } from '@/lib/tax/determine'

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request)
  if (csrf) return csrf
  const auth = await requirePermission('tax:view_config')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId } = auth
  const body = await parseTaxBody(request, taxExplainSchema)
  if (body instanceof NextResponse) return body
  return taxResponse(tenantId, () => explainTax(tenantId, body as TaxFacts))
}
