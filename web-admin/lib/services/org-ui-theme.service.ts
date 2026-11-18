/**
 * An Organization's saved themes (org_tenant_ui_theme_dtl): list, create, edit,
 * make one the theme in use, delete. Every query filters tenant_org_id; the plan
 * flags are enforced here again (the screen only displays them).
 *
 * @module lib/services/org-ui-theme.service
 */

import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { getFeatureFlags } from '@/lib/services/feature-flags.service'
import type { OrgThemeInput } from '@/lib/validations/ui-theme'

export type UiThemeErrorCode = 'NOT_FOUND' | 'FEATURE_NOT_IN_PLAN' | 'THEME_IN_USE' | 'INVALID_CATALOG_CODE'

/** A refused theme operation; routes map `code` to an HTTP status. */
export class UiThemeError extends Error {
  constructor(public readonly code: UiThemeErrorCode, message: string) {
    super(message)
    this.name = 'UiThemeError'
  }
}

/** HTTP status for each refusal. */
export const uiThemeErrorStatus: Record<UiThemeErrorCode, number> = {
  NOT_FOUND: 404,
  FEATURE_NOT_IN_PLAN: 403,
  THEME_IN_USE: 409,
  INVALID_CATALOG_CODE: 400,
}

/**
 * HQ catalogs the branding screen offers: active, live rows in display order.
 * @returns themes, radius presets and font pairs
 */
export async function getUiThemeCatalog() {
  const where = { is_active: true, rec_status: 1 }
  const orderBy = [{ rec_order: 'asc' as const }, { code: 'asc' as const }]
  const [themes, radii, fonts] = await Promise.all([
    prisma.sys_ui_theme_cd.findMany({
      where,
      orderBy,
      select: {
        code: true, name: true, name2: true, description: true, description2: true,
        brand_color_primary: true, brand_color_secondary: true, ui_radius_code: true, ui_font_pair_code: true, is_default: true,
      },
    }),
    prisma.sys_ui_radius_cd.findMany({
      where,
      orderBy,
      select: { code: true, name: true, name2: true, radius_sm: true, radius_md: true, radius_lg: true, is_default: true },
    }),
    prisma.sys_ui_font_pair_cd.findMany({
      where,
      orderBy,
      select: { code: true, name: true, name2: true, font_family_en: true, font_family_ar: true, is_default: true },
    }),
  ])
  return { themes, radii, fonts }
}

/** Who made the change (audit columns). */
export interface ThemeActor {
  userId: string
  userInfo?: string
}

const LIVE = { rec_status: 1 }

/**
 * Live saved themes of one Organization, the one in use first.
 * @param tenantId - Organization id
 * @returns Saved theme rows
 */
export async function listOrgThemes(tenantId: string) {
  return prisma.org_tenant_ui_theme_dtl.findMany({
    where: { tenant_org_id: tenantId, ...LIVE },
    orderBy: [{ is_active: 'desc' }, { rec_order: 'asc' }, { theme_name: 'asc' }],
  })
}

/** Refuse what the plan does not include, and HQ codes that are unknown or inactive. */
async function checkInput(tenantId: string, input: OrgThemeInput): Promise<void> {
  const flags = await getFeatureFlags(tenantId)
  const overrides = [input.brand_color_primary, input.brand_color_secondary, input.ui_radius_code, input.ui_font_pair_code]
  if (overrides.some(Boolean) && flags.custom_branding !== true) {
    throw new UiThemeError('FEATURE_NOT_IN_PLAN', 'Colour, corner and font overrides are not in this plan.')
  }
  if ((input.app_display_name || input.app_display_name2) && flags.white_label !== true) {
    throw new UiThemeError('FEATURE_NOT_IN_PLAN', 'A custom app name is not in this plan.')
  }

  const live = { is_active: true, rec_status: 1 }
  const [theme, radius, font] = await Promise.all([
    prisma.sys_ui_theme_cd.count({ where: { code: input.ui_theme_code, ...live } }),
    input.ui_radius_code ? prisma.sys_ui_radius_cd.count({ where: { code: input.ui_radius_code, ...live } }) : 1,
    input.ui_font_pair_code ? prisma.sys_ui_font_pair_cd.count({ where: { code: input.ui_font_pair_code, ...live } }) : 1,
  ])
  if (!theme || !radius || !font) {
    throw new UiThemeError('INVALID_CATALOG_CODE', 'Unknown or inactive theme, corner style or font.')
  }
}

/** Plan-gated columns: an update that leaves one out keeps the stored value (kept for a plan upgrade). */
const PLAN_GATED = ['brand_color_primary', 'brand_color_secondary', 'ui_radius_code', 'ui_font_pair_code', 'app_display_name', 'app_display_name2'] as const

/** Column values from the input; empty overrides are stored as NULL (= HQ value). */
function toColumns(input: OrgThemeInput) {
  return {
    theme_name: input.theme_name,
    theme_name2: input.theme_name2 ?? null,
    ui_theme_code: input.ui_theme_code,
    brand_color_primary: input.brand_color_primary?.toUpperCase() ?? null,
    brand_color_secondary: input.brand_color_secondary?.toUpperCase() ?? null,
    ui_radius_code: input.ui_radius_code ?? null,
    ui_font_pair_code: input.ui_font_pair_code ?? null,
    default_ui_density: input.default_ui_density ?? null,
    app_display_name: input.app_display_name ?? null,
    app_display_name2: input.app_display_name2 ?? null,
  }
}

/**
 * Save a new theme (not in use until made active).
 * @param tenantId - Organization id (from the session)
 * @param input - Validated body
 * @param actor - Who saves
 * @returns The new row
 * @throws UiThemeError FEATURE_NOT_IN_PLAN, INVALID_CATALOG_CODE
 */
export async function createOrgTheme(tenantId: string, input: OrgThemeInput, actor: ThemeActor) {
  await checkInput(tenantId, input)
  return prisma.org_tenant_ui_theme_dtl.create({
    data: {
      ...toColumns(input),
      tenant_org_id: tenantId,
      is_active: false,
      created_by: actor.userId,
      created_info: actor.userInfo ?? null,
    },
  })
}

/**
 * Edit a saved theme (also the one in use; the change shows on the next page load).
 * @throws UiThemeError NOT_FOUND (not this Organization's), FEATURE_NOT_IN_PLAN, INVALID_CATALOG_CODE
 */
export async function updateOrgTheme(tenantId: string, id: string, input: OrgThemeInput, actor: ThemeActor): Promise<void> {
  await checkInput(tenantId, input)
  const columns: Partial<ReturnType<typeof toColumns>> = toColumns(input)
  for (const key of PLAN_GATED) if (input[key] === undefined) delete columns[key]
  const { count } = await prisma.org_tenant_ui_theme_dtl.updateMany({
    where: { id, tenant_org_id: tenantId, ...LIVE },
    data: { ...columns, updated_at: new Date(), updated_by: actor.userId, updated_info: actor.userInfo ?? null },
  })
  if (!count) throw new UiThemeError('NOT_FOUND', 'Theme not found.')
}

/**
 * Make a saved theme the one in use: old off and new on in one transaction. The
 * partial unique index (one in use per Organization) refuses a concurrent second switch.
 * @throws UiThemeError NOT_FOUND
 */
export async function activateOrgTheme(tenantId: string, id: string, actor: ThemeActor): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const target = await tx.org_tenant_ui_theme_dtl.findFirst({ where: { id, tenant_org_id: tenantId, ...LIVE }, select: { id: true } })
    if (!target) throw new UiThemeError('NOT_FOUND', 'Theme not found.')
    const audit = { updated_at: new Date(), updated_by: actor.userId, updated_info: actor.userInfo ?? null }
    await tx.org_tenant_ui_theme_dtl.updateMany({
      where: { tenant_org_id: tenantId, is_active: true, ...LIVE },
      data: { is_active: false, ...audit },
    })
    const { count } = await tx.org_tenant_ui_theme_dtl.updateMany({
      where: { id, tenant_org_id: tenantId, ...LIVE },
      data: { is_active: true, ...audit },
    })
    // Deleted after the read: throwing rolls back the "old off" too, so one theme stays in use.
    if (count !== 1) throw new UiThemeError('NOT_FOUND', 'Theme not found.')
  })
}

/**
 * Soft-delete a saved theme. The theme in use cannot be deleted; make another active first.
 * @throws UiThemeError NOT_FOUND, THEME_IN_USE
 */
export async function deleteOrgTheme(tenantId: string, id: string, actor: ThemeActor): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const row = await tx.org_tenant_ui_theme_dtl.findFirst({ where: { id, tenant_org_id: tenantId, ...LIVE }, select: { id: true, is_active: true } })
    if (!row) throw new UiThemeError('NOT_FOUND', 'Theme not found.')
    if (row.is_active) throw new UiThemeError('THEME_IN_USE', 'The theme in use cannot be deleted.')
    // is_active: false in the where also covers a switch that landed after the read.
    const { count } = await tx.org_tenant_ui_theme_dtl.updateMany({
      where: { id, tenant_org_id: tenantId, is_active: false, ...LIVE },
      data: { rec_status: 0, deleted_at: new Date(), deleted_by: actor.userId, deleted_info: actor.userInfo ?? null },
    })
    if (!count) throw new UiThemeError('THEME_IN_USE', 'The theme in use cannot be deleted.')
  })
}
