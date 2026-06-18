import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/server-auth'
import { lookupAuditActors } from '@/lib/services/audit-actor.service'

const MAX_AUDIT_ACTOR_IDS = 10

/**
 * GET /api/v1/audit/actors
 * Resolve a small set of tenant-scoped audit actor ids into display names.
 */
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await getAuthContext()
    const rawIds = request.nextUrl.searchParams.getAll('id')

    const actorIds = [...new Set(rawIds.map((value) => value.trim()).filter(Boolean))].slice(
      0,
      MAX_AUDIT_ACTOR_IDS,
    )

    if (actorIds.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const actors = await lookupAuditActors(tenantId, actorIds)

    return NextResponse.json({
      success: true,
      data: actors,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to resolve audit actors'

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
