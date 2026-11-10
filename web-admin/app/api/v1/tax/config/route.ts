/** GET / PUT /api/v1/tax/config: the organization's tax setup. */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { validateCSRF } from '@/lib/middleware/csrf'
import { parseTaxBody, taxResponse } from '@/lib/services/tax/tax-route'
import { getTaxConfig, updateTaxConfig } from '@/lib/services/tax/tax-config.service'
import { taxConfigUpdateSchema } from '@/lib/validations/tax-schemas'
import type { TaxConfigUpdate } from '@/lib/services/tax/tax-config.service'

export async function GET(request: NextRequest) {
  const auth = await requirePermission('tax:view_config')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId } = auth
  return taxResponse(tenantId, () => getTaxConfig(tenantId))
}

export async function PUT(request: NextRequest) {
  const csrf = await validateCSRF(request)
  if (csrf) return csrf
  const auth = await requirePermission('tax:manage_config')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId, userId } = auth
  const body = await parseTaxBody(request, taxConfigUpdateSchema)
  if (body instanceof NextResponse) return body
  return taxResponse(tenantId, () => updateTaxConfig(tenantId, userId, body as TaxConfigUpdate).then(() => ({ saved: true })))
}
