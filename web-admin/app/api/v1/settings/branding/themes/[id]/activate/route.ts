/**
 * POST /api/v1/settings/branding/themes/[id]/activate — make a saved theme the one
 * in use for the session Organization (old one off, new one on, one transaction).
 */

import { NextRequest, NextResponse } from 'next/server';
import { activateOrgTheme } from '@/lib/services/org-ui-theme.service';
import { guardThemeWrite, revalidateTheme, themeErrorResponse, themeIdSchema } from '@/lib/services/org-ui-theme-http';

/**
 * Activate a saved theme.
 * @param request - Incoming request
 * @param ctx - Route params
 * @returns 200
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardThemeWrite(request);
    if (guard instanceof NextResponse) return guard;
    const id = themeIdSchema.safeParse((await ctx.params).id);
    if (!id.success) return NextResponse.json({ error: 'Invalid theme id' }, { status: 400 });
    await activateOrgTheme(guard.tenantId, id.data, guard.actor);
    revalidateTheme();
    return NextResponse.json({ success: true });
  } catch (err) {
    return themeErrorResponse(err, 'POST /settings/branding/themes/[id]/activate');
  }
}
