/**
 * POST /api/v1/settings/branding/themes — save a new theme for the session
 * Organization (not in use until made active). settings:branding; overrides need
 * the custom_branding plan flag, the app name needs white_label.
 */

import { NextRequest, NextResponse } from 'next/server';
import { orgThemeInputSchema } from '@/lib/validations/ui-theme';
import { createOrgTheme } from '@/lib/services/org-ui-theme.service';
import { fieldErrors, guardThemeWrite, themeErrorResponse } from '@/lib/services/org-ui-theme-http';

/**
 * Create a saved theme.
 * @param request - Body: {@link orgThemeInputSchema}
 * @returns 201 with the new row
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await guardThemeWrite(request);
    if (guard instanceof NextResponse) return guard;
    const parsed = orgThemeInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors: fieldErrors(parsed.error) }, { status: 400 });
    }
    const row = await createOrgTheme(guard.tenantId, parsed.data, guard.actor);
    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err) {
    return themeErrorResponse(err, 'POST /settings/branding/themes');
  }
}
