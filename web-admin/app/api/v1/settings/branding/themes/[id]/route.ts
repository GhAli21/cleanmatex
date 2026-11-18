/**
 * PATCH  /api/v1/settings/branding/themes/[id] — edit a saved theme
 * DELETE /api/v1/settings/branding/themes/[id] — delete a saved theme (not the one in use)
 * Both act only on the session Organization's rows (settings:branding).
 */

import { NextRequest, NextResponse } from 'next/server';
import { orgThemeInputSchema } from '@/lib/validations/ui-theme';
import { deleteOrgTheme, updateOrgTheme } from '@/lib/services/org-ui-theme.service';
import { fieldErrors, guardThemeWrite, revalidateTheme, themeErrorResponse, themeIdSchema } from '@/lib/services/org-ui-theme-http';

type Params = { params: Promise<{ id: string }> };

/**
 * Edit a saved theme; if it is the one in use, the change shows on the next page load.
 * @param request - Body: {@link orgThemeInputSchema}
 * @param ctx - Route params
 * @returns 200
 */
export async function PATCH(request: NextRequest, ctx: Params) {
  try {
    const guard = await guardThemeWrite(request);
    if (guard instanceof NextResponse) return guard;
    const id = themeIdSchema.safeParse((await ctx.params).id);
    if (!id.success) return NextResponse.json({ error: 'Invalid theme id' }, { status: 400 });
    const parsed = orgThemeInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors: fieldErrors(parsed.error) }, { status: 400 });
    }
    await updateOrgTheme(guard.tenantId, id.data, parsed.data, guard.actor);
    revalidateTheme();
    return NextResponse.json({ success: true });
  } catch (err) {
    return themeErrorResponse(err, 'PATCH /settings/branding/themes/[id]');
  }
}

/**
 * Soft-delete a saved theme. 409 for the theme in use.
 * @param request - Incoming request
 * @param ctx - Route params
 * @returns 200
 */
export async function DELETE(request: NextRequest, ctx: Params) {
  try {
    const guard = await guardThemeWrite(request);
    if (guard instanceof NextResponse) return guard;
    const id = themeIdSchema.safeParse((await ctx.params).id);
    if (!id.success) return NextResponse.json({ error: 'Invalid theme id' }, { status: 400 });
    await deleteOrgTheme(guard.tenantId, id.data, guard.actor);
    return NextResponse.json({ success: true });
  } catch (err) {
    return themeErrorResponse(err, 'DELETE /settings/branding/themes/[id]');
  }
}
