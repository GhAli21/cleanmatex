/** GET / POST /api/v1/tax/codes: tax codes. */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { validateCSRF } from '@/lib/middleware/csrf'
import { parseTaxBody, taxInvalid, taxResponse } from '@/lib/services/tax/tax-route'
import { createTaxCode, listTaxCodes } from '@/lib/services/tax/tax-codes.service'
import { taxCodeCreateSchema, taxListQuerySchema } from '@/lib/validations/tax-schemas'
import type { TaxCodeCreate } from '@/lib/services/tax/tax-codes.service'

export async function GET(request: NextRequest) {
  const auth = await requirePermission('tax:view_config')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId } = auth
  const query = taxListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!query.success) return taxInvalid()
  return taxResponse(tenantId, () => listTaxCodes(tenantId, query.data))
}

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request)
  if (csrf) return csrf
  const auth = await requirePermission('tax:manage_config')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId, userId } = auth
  const body = await parseTaxBody(request, taxCodeCreateSchema)
  if (body instanceof NextResponse) return body
  return taxResponse(tenantId, () => createTaxCode(tenantId, userId, body as TaxCodeCreate), 201)
}
