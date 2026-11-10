/** GET / POST /api/v1/tax/item-classes: item tax classes. */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { validateCSRF } from '@/lib/middleware/csrf'
import { parseTaxBody, taxResponse } from '@/lib/services/tax/tax-route'
import { createTaxClass, listTaxClasses } from '@/lib/services/tax/tax-classes.service'
import { taxClassCreateSchema } from '@/lib/validations/tax-schemas'
import type { TaxClassCreate } from '@/lib/services/tax/tax-classes.service'

export async function GET(request: NextRequest) {
  const auth = await requirePermission('tax:view_config')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId } = auth
  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
  return taxResponse(tenantId, () => listTaxClasses(tenantId, includeInactive))
}

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request)
  if (csrf) return csrf
  const auth = await requirePermission('tax:manage_config')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId, userId } = auth
  const body = await parseTaxBody(request, taxClassCreateSchema)
  if (body instanceof NextResponse) return body
  return taxResponse(tenantId, () => createTaxClass(tenantId, userId, body as TaxClassCreate), 201)
}
