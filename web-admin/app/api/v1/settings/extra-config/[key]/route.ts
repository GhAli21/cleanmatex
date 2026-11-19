/**
 * Organization Extra Configuration Per-Key Reset API
 *
 *   DELETE /api/v1/settings/extra-config/[key] — soft-delete one override so it reverts to sys default
 */

import { NextRequest, NextResponse } from 'next/server';
import { extraConfigKeySchema } from '@/lib/validations/tenant-extra-config';
import { resetTenantExtraConfigKey } from '@/lib/services/tenant-extra-config.service';
import {
  extraConfigErrorResponse,
  guardExtraConfigWrite,
  revalidateExtraConfigLayout,
} from '@/lib/services/tenant-extra-config-http';

/**
 * Reset a single Extra Tenant Configuration key back to its global preferred default.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const guard = await guardExtraConfigWrite(request);
    if (guard instanceof NextResponse) return guard;

    const { key } = await context.params;
    const parsedKey = extraConfigKeySchema.safeParse(key);
    if (!parsedKey.success) {
      return NextResponse.json(
        { error: 'Invalid configuration key format', code: 'INVALID_KEY' },
        { status: 400 }
      );
    }

    const payload = await resetTenantExtraConfigKey(
      guard.tenantId,
      parsedKey.data,
      guard.actor
    );
    revalidateExtraConfigLayout();

    return NextResponse.json(
      { success: true, data: payload },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return extraConfigErrorResponse(err, 'DELETE /api/v1/settings/extra-config/[key]');
  }
}
