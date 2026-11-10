/** GET /api/v1/tax/options: lookups for the tax forms. */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { taxResponse } from '@/lib/services/tax/tax-route'
import { getTaxOptions } from '@/lib/services/tax/tax-config.service'

export async function GET(request: NextRequest) {
  const auth = await requirePermission('tax:view_config')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId } = auth
  return taxResponse(tenantId, () => getTaxOptions(tenantId))
}
