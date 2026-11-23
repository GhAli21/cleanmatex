/**
 * Request bodies for appearance routes, built from `lib/constants/ui-theme`.
 * Both schemas are strict: unknown keys (ids, tenant, email) are rejected.
 * @module lib/validations/ui-theme
 */

import { z } from 'zod'
import {
  MAX_SIDEBAR_PINS_PER_TENANT,
  UI_CATALOG_CODE_PATTERN,
  UI_COLOR_MODES,
  UI_DENSITIES,
  UI_FONT_SCALES,
  UI_SIDEBAR_THEMES,
} from '@/lib/constants/ui-theme'

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'must be #RRGGBB')
const catalogCode = z.string().regex(UI_CATALOG_CODE_PATTERN, 'must be an UPPERCASE code')
const name = z.string().trim().min(1).max(80)
const sidebarPinnedMapSchema = z.record(
  z.string().uuid(),
  z.array(z.string().trim().min(1).max(64)).max(MAX_SIDEBAR_PINS_PER_TENANT),
)

/** `PUT /api/v1/me/ui-preferences`: only the caller's own UI preference columns. */
export const uiPreferencesSchema = z
  .object({
    ui_color_mode: z.enum(UI_COLOR_MODES).optional(),
    // null = follow the Organization's default density.
    ui_density: z.enum(UI_DENSITIES).nullable().optional(),
    ui_font_scale: z.enum(UI_FONT_SCALES).optional(),
    ui_sidebar_theme: z.enum(UI_SIDEBAR_THEMES).nullable().optional(),
    ui_sidebar_pinned: sidebarPinnedMapSchema.nullable().optional(),
  })
  .strict()
export type UiPreferencesInput = z.infer<typeof uiPreferencesSchema>

/** Create or edit one saved Organization theme. A missing or null override means "use the HQ theme's value". */
export const orgThemeInputSchema = z
  .object({
    theme_name: name,
    theme_name2: name.nullable().optional(),
    ui_theme_code: catalogCode,
    brand_color_primary: hex.nullable().optional(),
    brand_color_secondary: hex.nullable().optional(),
    ui_radius_code: catalogCode.nullable().optional(),
    ui_font_pair_code: catalogCode.nullable().optional(),
    default_ui_density: z.enum(UI_DENSITIES).nullable().optional(),
    app_display_name: name.nullable().optional(),
    app_display_name2: name.nullable().optional(),
  })
  .strict()
export type OrgThemeInput = z.infer<typeof orgThemeInputSchema>
