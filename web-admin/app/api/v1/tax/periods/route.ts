/** GET / POST /api/v1/tax/periods: tax return periods. */
import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermission, requirePermission } from '@/lib/middleware/require-permission'
import { validateCSRF } from '@/lib/middleware/csrf'
import { parseTaxBody, taxResponse } from '@/lib/services/tax/tax-route'
import { createTaxPeriod, listTaxPeriods } from '@/lib/services/tax/tax-period.service'
import { taxPeriodCreateSchema } from '@/lib/validations/tax-schemas'

export async function GET(request: NextRequest) {
  // Read by the settings tab and by the VAT Return period picker.
  const auth = await requireAnyPermission(['tax:view_config', 'tax:view_reports', 'tax:manage_periods'])(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId } = auth
  return taxResponse(tenantId, () => listTaxPeriods(tenantId))
}

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request)
  if (csrf) return csrf
  const auth = await requirePermission('tax:manage_periods')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId, userId } = auth
  const body = await parseTaxBody(request, taxPeriodCreateSchema)
  if (body instanceof NextResponse) return body
  return taxResponse(tenantId, () => createTaxPeriod(tenantId, userId, body), 201)
}
