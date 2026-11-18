/**
 * Settings → Branding API
 *
 *   GET /api/v1/settings/branding — the Organization's saved themes, the HQ theme
 *   catalog and what its plan allows (custom_branding, white_label).
 *
 * Saved themes are written through /api/v1/settings/branding/themes. The logo,
 * dark logo and favicon are File Util uploads (category TENANT_LOGO).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getFeatureFlags } from '@/lib/services/feature-flags.service';
import { getUiThemeCatalog, listOrgThemes } from '@/lib/services/org-ui-theme.service';
import { logger } from '@/lib/utils/logger';

/**
 * Load the branding screen.
 * @param request - Incoming request
 * @returns themes, catalog and plan limits of the session Organization
 */
export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('settings:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const [themes, catalog, flags] = await Promise.all([
      listOrgThemes(tenantId),
      getUiThemeCatalog(),
      getFeatureFlags(tenantId),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        themes,
        catalog,
        plan: { customBranding: flags.custom_branding === true, whiteLabel: flags.white_label === true },
      },
    });
  } catch (err) {
    logger.error('GET /settings/branding failed', err instanceof Error ? err : new Error(String(err)), {});
    return NextResponse.json({ error: 'Failed to load branding settings' }, { status: 500 });
  }
}
