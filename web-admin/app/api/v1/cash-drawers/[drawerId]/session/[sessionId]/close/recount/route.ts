import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { recountClose } from '@/lib/services/cash-drawer-session.service';
import { countInputSchema } from '@/lib/validations/cash-drawer/session-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

const schema = z.object({
  currencyCode: z.string().length(3),
  count: countInputSchema,
  supersedesCountId: z.string().uuid(),
  notes: z.string().trim().max(1000).optional(),
});

/**
 * POST /api/v1/cash-drawers/[drawerId]/session/[sessionId]/close/recount
 *
 * CLF §4B.7 — supervisor recount while the session is `CLOSING`, superseding
 * the prior closing (or recount) count for one currency against the same cut
 * the count step already froze.
 * @param request JSON body matching `schema`
 * @param root0 route params
 * @param root0.params drawer and session ids
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string; sessionId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:approve_variance')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { drawerId, sessionId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await recountClose(tenantId, userId, {
      sessionId,
      drawerId,
      currencyCode: parsed.data.currencyCode,
      count: parsed.data.count,
      supersedesCountId: parsed.data.supersedesCountId,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to record the recount');
  }
}
