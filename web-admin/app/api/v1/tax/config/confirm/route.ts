/** POST /api/v1/tax/config/confirm: activates the pending setup; `ok: false` lists what is missing. */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { validateCSRF } from '@/lib/middleware/csrf'
import { parseTaxBody, taxResponse } from '@/lib/services/tax/tax-route'
import { confirmTaxConfig } from '@/lib/services/tax/tax-config.service'
import { taxConfirmSchema } from '@/lib/validations/tax-schemas'

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request)
  if (csrf) return csrf
  const auth = await requirePermission('tax:manage_config')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId, userId } = auth
  const body = await parseTaxBody(request, taxConfirmSchema)
  if (body instanceof NextResponse) return body
  return taxResponse(tenantId, () => confirmTaxConfig(tenantId, userId, body.note))
}
