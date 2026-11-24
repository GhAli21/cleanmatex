/**
 * GET /api/v1/notifications/campaigns/whatsapp-templates — approved WhatsApp marketing templates this
 * Organization can choose on a campaign, with their languages and variables (STEP5_PLAN 4c, migration 0819).
 *
 * Requires: notifications:manage permission (same as creating a campaign)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { listWhatsAppMarketingTemplates } from '@/lib/notifications/campaign-wa-templates.service'
import { logger } from '@/lib/utils/logger'

/**
 * Lists the templates HQ activated a `campaign.send` WhatsApp route for.
 * @param request Incoming request (authenticated by the permission guard).
 * @returns `{ success, data: WhatsAppMarketingTemplate[] }`, empty when none is available.
 */
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('notifications:manage')(request)
  if (authCheck instanceof NextResponse) return authCheck

  try {
    return NextResponse.json({ success: true, data: await listWhatsAppMarketingTemplates(authCheck.tenantId) })
  } catch (err) {
    logger.error('GET /api/v1/notifications/campaigns/whatsapp-templates failed', err instanceof Error ? err : new Error(String(err)), {
      tenantId: authCheck.tenantId, feature: 'notifications-campaigns',
    })
    return NextResponse.json({ success: false, error: 'Failed to load WhatsApp templates' }, { status: 500 })
  }
}
