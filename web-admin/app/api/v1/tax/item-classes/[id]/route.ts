/** PATCH /api/v1/tax/item-classes/[id]: changes an item tax class. */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { validateCSRF } from '@/lib/middleware/csrf'
import { parseTaxBody, taxResponse } from '@/lib/services/tax/tax-route'
import { updateTaxClass } from '@/lib/services/tax/tax-classes.service'
import { taxClassPatchSchema } from '@/lib/validations/tax-schemas'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = await validateCSRF(request)
  if (csrf) return csrf
  const auth = await requirePermission('tax:manage_config')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId, userId } = auth
  const { id } = await params
  const body = await parseTaxBody(request, taxClassPatchSchema)
  if (body instanceof NextResponse) return body
  return taxResponse(tenantId, () => updateTaxClass(tenantId, userId, id, body))
}
