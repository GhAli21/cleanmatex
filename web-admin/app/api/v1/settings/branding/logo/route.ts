/**
 * Settings → Branding → Logo upload
 *
 *   POST /api/v1/settings/branding/logo  (multipart/form-data, field "file")
 *
 * Returns `{ success, url }` where `url` is the public MinIO URL. The route
 * does NOT persist `org_tenants_mst.logo_url` — the Branding page must call
 * PUT /api/v1/settings/branding with the returned URL to commit. This split
 * keeps an unsubmitted preview from polluting the persisted column, and it
 * lets us reject the URL at PUT time via host-validation.
 *
 * CSRF runs BEFORE `request.formData()` because formData consumes the body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { validateCSRF } from '@/lib/middleware/csrf';
import { logger } from '@/lib/utils/logger';
import { uploadTenantLogo } from '@/lib/storage/tenant-logo';

/**
 *
 * @param request
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF first — must run before formData() consumes the body.
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) return csrfResponse;

    const authCheck = await requirePermission('settings:branding')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const rl = await checkAPIRateLimitTenant(tenantId);
    if (rl) return rl;

    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Missing "file" field in multipart form-data' },
        { status: 400 }
      );
    }

    const result = await uploadTenantLogo(file, tenantId);
    if (!result.success || !result.url) {
      return NextResponse.json(
        { error: result.error ?? 'Logo upload failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, url: result.url });
  } catch (err) {
    logger.error(
      'POST /settings/branding/logo failed',
      err instanceof Error ? err : new Error(String(err)),
      {}
    );
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
  }
}
