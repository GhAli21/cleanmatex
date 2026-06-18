/**
 * PATCH /api/v1/settings/payments/card-brands/[brandId]
 *
 * Updates tenant-managed card brand overrides while preserving the immutable HQ
 * brand code used elsewhere in payment records.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import {
  toggleTenantCardBrandActive,
  updateTenantCardBrandConfig,
} from '@/lib/services/payment-card-brand.service';

const schema = z.object({
  name: z.string().min(1).max(250).optional(),
  name2: z.string().max(250).nullable().optional(),
  description: z.string().nullable().optional(),
  description2: z.string().nullable().optional(),
  recOrder: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Updates one tenant card brand config row.
 * @param request
 * @param root0
 * @param root0.params
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  // Guard against cross-site form submissions for authenticated mutations.
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('payment_config:manage')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { brandId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    );
  }

  if (
    parsed.data.name === undefined &&
    parsed.data.name2 === undefined &&
    parsed.data.description === undefined &&
    parsed.data.description2 === undefined &&
    parsed.data.recOrder === undefined &&
    parsed.data.isActive === undefined
  ) {
    return NextResponse.json(
      { success: false, error: 'No changes provided' },
      { status: 400 }
    );
  }

  try {
    const hasFieldUpdates =
      parsed.data.name !== undefined ||
      parsed.data.name2 !== undefined ||
      parsed.data.description !== undefined ||
      parsed.data.description2 !== undefined ||
      parsed.data.recOrder !== undefined;

    let data;

    if (hasFieldUpdates) {
      data = await updateTenantCardBrandConfig(
        tenantId,
        brandId,
        {
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.name2 !== undefined && { name2: parsed.data.name2 }),
          ...(parsed.data.description !== undefined && { description: parsed.data.description }),
          ...(parsed.data.description2 !== undefined && { description2: parsed.data.description2 }),
          ...(parsed.data.recOrder !== undefined && { rec_order: parsed.data.recOrder }),
        },
        userId
      );
    }

    if (parsed.data.isActive !== undefined) {
      data = await toggleTenantCardBrandActive(tenantId, brandId, parsed.data.isActive, userId);
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update card brand';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
