/**
 * GET /api/v1/me/ui-preferences — the signed-in person's appearance & sidebar preferences
 * PUT /api/v1/me/ui-preferences — change them (colour mode, density, font size, sidebar theme, pinned screens)
 *
 * The row is always the caller's own (`sys_users_mst.id` = session user id) and
 * only the ui_* columns can change. No permission is needed: everyone may
 * set their own appearance and pinned navigation shortcuts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { getAuthContext } from '@/lib/middleware/require-permission'
import { validateCSRF } from '@/lib/middleware/csrf'
import { writeLastModeCookie } from '@/lib/services/ui-theme.service'
import { uiPreferencesSchema } from '@/lib/validations/ui-theme'
import { logger } from '@/lib/utils/logger'

const SELECT = {
  ui_color_mode: true,
  ui_density: true,
  ui_font_scale: true,
  ui_sidebar_theme: true,
  ui_sidebar_pinned: true,
} as const

async function sessionUserId(): Promise<string | null> {
  try {
    return (await getAuthContext()).userId
  } catch {
    return null
  }
}

/**
 * Read the caller's preferences.
 * @param _request - Incoming request
 * @returns ui_color_mode, ui_density, ui_font_scale, ui_sidebar_theme, ui_sidebar_pinned
 */
export async function GET(_request: NextRequest) {
  const userId = await sessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = await prisma.sys_users_mst.findFirst({ where: { id: userId }, select: SELECT })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    logger.error('GET /me/ui-preferences failed', err instanceof Error ? err : new Error(String(err)), {})
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 })
  }
}

/**
 * Change the caller's preferences; fields left out stay as they are.
 * @param request - Body: {@link uiPreferencesSchema} (strict)
 * @returns The saved preferences
 */
export async function PUT(request: NextRequest) {
  const csrf = await validateCSRF(request)
  if (csrf) return csrf
  const userId = await sessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = uiPreferencesSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  const {
    ui_color_mode,
    ui_density,
    ui_font_scale,
    ui_sidebar_theme,
    ui_sidebar_pinned,
  } = parsed.data

  const updateData: Prisma.sys_users_mstUpdateInput = {
    updated_at: new Date(),
    updated_by: userId,
    updated_info: request.headers.get('user-agent') ?? null,
  }
  if (ui_color_mode !== undefined) updateData.ui_color_mode = ui_color_mode
  if (ui_density !== undefined) updateData.ui_density = ui_density
  if (ui_font_scale !== undefined) updateData.ui_font_scale = ui_font_scale
  if (ui_sidebar_theme !== undefined) updateData.ui_sidebar_theme = ui_sidebar_theme
  if (ui_sidebar_pinned !== undefined) {
    updateData.ui_sidebar_pinned =
      ui_sidebar_pinned === null ? Prisma.JsonNull : ui_sidebar_pinned
  }

  try {
    const data = await prisma.sys_users_mst.update({
      where: { id: userId },
      data: updateData,
      select: SELECT,
    })

    if (data.ui_color_mode) {
      writeLastModeCookie(await cookies(), data.ui_color_mode)
    }
    if (ui_color_mode !== undefined || ui_density !== undefined || ui_font_scale !== undefined) {
      revalidatePath('/', 'layout')
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    logger.error('PUT /me/ui-preferences failed', err instanceof Error ? err : new Error(String(err)), {})
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
