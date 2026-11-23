/**
 * GET /api/v1/customers/:id/marketing-consent — the customer's marketing consent per channel
 * PUT /api/v1/customers/:id/marketing-consent — record staff-entered consent decisions
 *
 * Customer campaigns send only to customers who agreed on the campaign's channel (migration 0818).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { MARKETING_CONSENT_CHANNELS } from '@/lib/constants/notification-campaigns';
import {
  getCustomerMarketingConsent,
  setCustomerMarketingConsent,
} from '@/lib/services/customer-marketing-consent.service';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const putSchema = z.object({
  channels: z.array(z.object({ channel: z.enum(MARKETING_CONSENT_CHANNELS), agreed: z.boolean() }))
    .min(1).max(MARKETING_CONSENT_CHANNELS.length)
    .refine((list) => new Set(list.map((c) => c.channel)).size === list.length, 'Each channel once'),
});

const notFound = () => NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });

/**
 * @param request - Incoming request
 * @param root0 - Route context
 * @param root0.params - Customer id
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requirePermission('customers:read')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { id: customerId } = await params;
  try {
    const data = await getCustomerMarketingConsent(authCheck.tenantId, customerId);
    return data ? NextResponse.json({ success: true, data }) : notFound();
  } catch (error) {
    log.error('[API] GET /customers/.../marketing-consent error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'customer_marketing_consent', tenantId: authCheck.tenantId,
    });
    return NextResponse.json({ success: false, error: 'Failed to load marketing consent' }, { status: 500 });
  }
}

/**
 * @param request - Incoming request
 * @param root0 - Route context
 * @param root0.params - Customer id
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrfResponse = await validateCSRF(request);
  if (csrfResponse) return csrfResponse;
  const authCheck = await requirePermission('customers:update')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { id: customerId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const data = await setCustomerMarketingConsent(authCheck.tenantId, customerId, parsed.data.channels, {
      userId: authCheck.userId, userName: authCheck.userName,
    });
    return data ? NextResponse.json({ success: true, data }) : notFound();
  } catch (error) {
    log.error('[API] PUT /customers/.../marketing-consent error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'customer_marketing_consent', tenantId: authCheck.tenantId,
    });
    return NextResponse.json({ success: false, error: 'Failed to save marketing consent' }, { status: 500 });
  }
}
