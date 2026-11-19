/**
 * Loads the inputs of the theme resolver: HQ catalogs, the Organization's theme
 * in use, its plan flags and the signed-in person's preferences.
 *
 * One read set per request (`getRequestTheme` is `cache()`d); no extra cache layer
 * (design 5.2). Flags come from the shared HQ resolver (`getFeatureFlags`).
 *
 * @module lib/services/ui-theme.service
 */

import 'server-only'

import { cache } from 'react'
import { prisma } from '@/lib/db/prisma'
import { getSessionIdentity } from '@/lib/db/tenant-context'
import { getFeatureFlags } from '@/lib/services/feature-flags.service'
import { resolveTheme } from '@/lib/theme/resolve-theme'
import { buildLastBrand, LAST_BRAND_COOKIE, LAST_BRAND_MAX_AGE_SEC } from '@/lib/theme/last-brand'
import type { ResolvedTheme } from '@/lib/types/ui-theme'
import { logger } from '@/lib/utils/logger'

const NO_INPUTS = { themes: [], radii: [], fonts: [], orgTheme: null, customBranding: false, whiteLabel: false, user: null, logoUrl: null }

/** The built-in STANDARD appearance (signed out, or any read failure). */
export const DEFAULT_THEME: ResolvedTheme = resolveTheme(NO_INPUTS)

/**
 * Theme of one Organization, optionally with one person's preferences.
 * For callers outside a page request (documents, mobile API) pass no user.
 * @param tenantId - Organization id (every org_* read filters on it)
 * @param userId - `sys_users_mst.id` of the person, or null
 * @returns The resolved theme
 */
export async function getTenantTheme(tenantId: string, userId: string | null = null): Promise<ResolvedTheme> {
  const live = { rec_status: 1 }
  const [themes, radii, fonts, orgTheme, user, flags, tenant] = await Promise.all([
    prisma.sys_ui_theme_cd.findMany({
      where: live,
      select: { code: true, brand_color_primary: true, brand_color_secondary: true, ui_radius_code: true, ui_font_pair_code: true, is_default: true },
    }),
    prisma.sys_ui_radius_cd.findMany({
      where: live,
      select: { code: true, radius_sm: true, radius_md: true, radius_lg: true, is_default: true },
    }),
    prisma.sys_ui_font_pair_cd.findMany({ where: live, select: { code: true, is_default: true } }),
    prisma.org_tenant_ui_theme_dtl.findFirst({
      where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
      select: {
        ui_theme_code: true,
        brand_color_primary: true,
        brand_color_secondary: true,
        ui_radius_code: true,
        ui_font_pair_code: true,
        default_ui_density: true,
        app_display_name: true,
        app_display_name2: true,
      },
    }),
    userId
      ? prisma.sys_users_mst.findFirst({ where: { id: userId }, select: { ui_color_mode: true, ui_density: true, ui_font_scale: true } })
      : null,
    getFeatureFlags(tenantId),
    // org_tenants_mst is the tenant itself: its id is the tenant id.
    prisma.org_tenants_mst.findFirst({ where: { id: tenantId }, select: { logo_url: true } }),
  ])
  return resolveTheme({
    themes,
    radii,
    fonts,
    orgTheme,
    customBranding: flags.custom_branding === true,
    whiteLabel: flags.white_label === true,
    user,
    logoUrl: tenant?.logo_url ?? null,
  })
}

/**
 * The Organization's resolved primary brand colour, for public profiles (slug
 * resolve, mobile customer app). Never throws.
 * @param tenantId - Organization id
 * @returns `#RRGGBB`, or null when the theme cannot be read
 */
export async function getTenantPrimaryColor(tenantId: string): Promise<string | null> {
  try {
    return (await getTenantTheme(tenantId)).seeds.primary
  } catch (error) {
    logger.error('getTenantPrimaryColor failed', error instanceof Error ? error : new Error(String(error)), {})
    return null
  }
}

/** The part of Next's cookie store this module writes to. */
interface CookieWriter {
  set(name: string, value: string, options: Record<string, unknown>): unknown
}

/**
 * Remember this Organization's public brand on the device for the login page.
 * Called by the sign-in routes once the session is bound to an Organization.
 * Never throws: sign-in must not fail because of branding.
 * @param cookieStore - `await cookies()` of the sign-in route
 * @param tenantId - The Organization the session was bound to
 */
export async function writeLastBrandCookie(cookieStore: CookieWriter, tenantId: string): Promise<void> {
  try {
    const theme = await getTenantTheme(tenantId)
    cookieStore.set(LAST_BRAND_COOKIE, buildLastBrand(theme, theme.logoUrl), {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: LAST_BRAND_MAX_AGE_SEC,
    })
  } catch (error) {
    logger.error('writeLastBrandCookie failed; login page keeps its current brand', error instanceof Error ? error : new Error(String(error)), {})
  }
}

/**
 * The current page's theme: the session's Organization and person, read once
 * per request. Never throws; a page must not fail because of its theme.
 * @returns The resolved theme, or {@link DEFAULT_THEME}
 */
export const getRequestTheme = cache(async (): Promise<ResolvedTheme> => {
  try {
    const identity = await getSessionIdentity()
    return identity ? await getTenantTheme(identity.tenantId, identity.userId) : DEFAULT_THEME
  } catch (error) {
    logger.error('getRequestTheme failed; using STANDARD', error instanceof Error ? error : new Error(String(error)), {})
    return DEFAULT_THEME
  }
})
