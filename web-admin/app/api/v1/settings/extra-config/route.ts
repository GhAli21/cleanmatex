/**
 * Organization Extra Configuration API
 *
 *   GET    /api/v1/settings/extra-config — grouped catalog metadata, curated option lists, overrides & effective values
 *   PUT    /api/v1/settings/extra-config — batch save/update validated overrides in one Prisma transaction
 *   DELETE /api/v1/settings/extra-config — reset all Organization overrides back to system defaults
 */

import { NextRequest, NextResponse } from 'next/server';
import { extraConfigSaveBatchSchema } from '@/lib/validations/tenant-extra-config';
import {
  getExtraConfigScreenData,
  resetAllTenantExtraConfig,
  upsertTenantExtraConfigBatch,
} from '@/lib/services/tenant-extra-config.service';
import {
  extraConfigErrorResponse,
  guardExtraConfigRead,
  guardExtraConfigWrite,
  revalidateExtraConfigLayout,
} from '@/lib/services/tenant-extra-config-http';
import { fieldErrors } from '@/lib/services/org-ui-theme-http';

/**
 * Load catalog items, curated option lists, and current Organization overrides.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await guardExtraConfigRead(request);
    if (auth instanceof NextResponse) return auth;

    const payload = await getExtraConfigScreenData(auth.tenantId);
    return NextResponse.json(
      { success: true, data: payload },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return extraConfigErrorResponse(err, 'GET /api/v1/settings/extra-config');
  }
}

/**
 * Save a batch of validated configuration entries for the active Organization.
 */
export async function PUT(request: NextRequest) {
  try {
    const guard = await guardExtraConfigWrite(request);
    if (guard instanceof NextResponse) return guard;

    const body = await request.json().catch(() => null);
    const parsed = extraConfigSaveBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: fieldErrors(parsed.error) },
        { status: 400 }
      );
    }

    const payload = await upsertTenantExtraConfigBatch(
      guard.tenantId,
      parsed.data.entries,
      guard.actor
    );
    revalidateExtraConfigLayout();

    return NextResponse.json(
      { success: true, data: payload },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return extraConfigErrorResponse(err, 'PUT /api/v1/settings/extra-config');
  }
}

/**
 * Soft-delete every active Organization override so all settings revert to system defaults.
 */
export async function DELETE(request: NextRequest) {
  try {
    const guard = await guardExtraConfigWrite(request);
    if (guard instanceof NextResponse) return guard;

    const payload = await resetAllTenantExtraConfig(guard.tenantId, guard.actor);
    revalidateExtraConfigLayout();

    return NextResponse.json(
      { success: true, data: payload },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return extraConfigErrorResponse(err, 'DELETE /api/v1/settings/extra-config');
  }
}
