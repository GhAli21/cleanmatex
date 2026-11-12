/** GET /api/v1/tax/returns?from=&to=: VAT return boxes for a date range. */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { taxInvalid, taxResponse } from '@/lib/services/tax/tax-route'
import { getTaxReturn } from '@/lib/services/tax/tax-return.service'
import { taxReturnQuerySchema } from '@/lib/validations/tax-schemas'

export async function GET(request: NextRequest) {
  const auth = await requirePermission('tax:view_reports')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId } = auth
  const query = taxReturnQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!query.success) return taxInvalid(query.error.issues[0]?.message)
  return taxResponse(tenantId, () => getTaxReturn(tenantId, query.data))
}
