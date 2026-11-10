/** PATCH /api/v1/tax/rules/[id]: changes one of the tax rules. */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { validateCSRF } from '@/lib/middleware/csrf'
import { parseTaxBody, taxResponse } from '@/lib/services/tax/tax-route'
import { updateTaxRule } from '@/lib/services/tax/tax-rules.service'
import { taxRulePatchSchema } from '@/lib/validations/tax-schemas'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = await validateCSRF(request)
  if (csrf) return csrf
  const auth = await requirePermission('tax:manage_config')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId, userId } = auth
  const { id } = await params
  const body = await parseTaxBody(request, taxRulePatchSchema)
  if (body instanceof NextResponse) return body
  return taxResponse(tenantId, () => updateTaxRule(tenantId, userId, id, body).then((row) => row ?? { saved: true }))
}
