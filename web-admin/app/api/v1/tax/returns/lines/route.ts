/** GET /api/v1/tax/returns/lines?from=&to=&box=: the tax lines behind one return box. */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { taxInvalid, taxResponse } from '@/lib/services/tax/tax-route'
import { getTaxReturnLines } from '@/lib/services/tax/tax-return.service'
import { taxReturnLinesQuerySchema } from '@/lib/validations/tax-schemas'

export async function GET(request: NextRequest) {
  const auth = await requirePermission('tax:view_reports')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId } = auth
  const query = taxReturnLinesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!query.success) return taxInvalid(query.error.issues[0]?.message)
  return taxResponse(tenantId, () => getTaxReturnLines(tenantId, query.data))
}
