/** PATCH /api/v1/tax/periods/[id]: close, or reopen with a reason. */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { validateCSRF } from '@/lib/middleware/csrf'
import { parseTaxBody, taxResponse } from '@/lib/services/tax/tax-route'
import { changeTaxPeriod } from '@/lib/services/tax/tax-period.service'
import { taxPeriodActionSchema } from '@/lib/validations/tax-schemas'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = await validateCSRF(request)
  if (csrf) return csrf
  const auth = await requirePermission('tax:manage_periods')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId, userId } = auth
  const { id } = await params
  const body = await parseTaxBody(request, taxPeriodActionSchema)
  if (body instanceof NextResponse) return body
  return taxResponse(tenantId, () => changeTaxPeriod(tenantId, userId, id, body))
}
