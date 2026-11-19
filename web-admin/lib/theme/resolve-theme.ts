/**
 * Theme resolution: HQ theme → the Organization's overrides (only where its
 * plan allows) → the user's preferences. Pure, so it is tested without a
 * database; `lib/services/ui-theme.service.ts` loads the inputs.
 *
 * @module lib/theme/resolve-theme
 */

import {
  DEFAULT_UI_DENSITY,
  DEFAULT_UI_FONT_PAIR_CODE,
  DEFAULT_UI_FONT_SCALE,
  DEFAULT_UI_RADIUS,
  DEFAULT_UI_THEME_CODE,
  UI_COLOR_MODES,
  UI_THEME_SEEDS,
  type UiColorMode,
  type UiDensity,
  type UiFontScale,
} from '@/lib/constants/ui-theme'
import type { ResolvedTheme } from '@/lib/types/ui-theme'

/** Inputs of {@link resolveTheme}: catalog rows (live ones), the theme in use, plan flags, the user. */
export interface ResolveThemeInput {
  themes: Array<{
    code: string
    brand_color_primary: string
    brand_color_secondary: string
    ui_radius_code: string
    ui_font_pair_code: string
    is_default: boolean
  }>
  radii: Array<{ code: string; radius_sm: string; radius_md: string; radius_lg: string; is_default: boolean }>
  fonts: Array<{ code: string; is_default: boolean }>
  /** The Organization's theme in use, or null when it has none. */
  orgTheme: {
    ui_theme_code: string
    brand_color_primary: string | null
    brand_color_secondary: string | null
    ui_radius_code: string | null
    ui_font_pair_code: string | null
    default_ui_density: string | null
    app_display_name: string | null
    app_display_name2: string | null
  } | null
  /** Plan flag `custom_branding`: colour, radius and font overrides apply. */
  customBranding: boolean
  /** Plan flag `white_label`: the app name applies. */
  whiteLabel: boolean
  /** The signed-in person's preferences, or null when signed out. */
  user: { ui_color_mode: string; ui_density: string | null; ui_font_scale: string } | null
  /** `org_tenants_mst.logo_url` (File Util's published MAIN logo), or null. */
  logoUrl: string | null
}

/**
 * Merge the layers into one page appearance. Never throws: a missing catalog
 * row falls back to the default row, then to the built-in STANDARD values.
 * @param input - {@link ResolveThemeInput}
 * @returns The resolved theme
 */
export function resolveTheme(input: ResolveThemeInput): ResolvedTheme {
  const { orgTheme: org, customBranding: custom } = input
  const hq =
    input.themes.find((t) => t.code === org?.ui_theme_code) ?? input.themes.find((t) => t.is_default) ?? null

  const radiusCode = (custom && org?.ui_radius_code) || hq?.ui_radius_code
  const radius = input.radii.find((r) => r.code === radiusCode) ?? input.radii.find((r) => r.is_default)
  const fontCode = (custom && org?.ui_font_pair_code) || hq?.ui_font_pair_code
  const font = input.fonts.find((f) => f.code === fontCode) ?? input.fonts.find((f) => f.is_default)
  const mode = input.user?.ui_color_mode

  return {
    // Checked, because it is written into <html data-mode>; anything else follows the device.
    mode: UI_COLOR_MODES.includes(mode as UiColorMode) ? (mode as UiColorMode) : 'SYSTEM',
    density: (input.user?.ui_density ?? org?.default_ui_density ?? DEFAULT_UI_DENSITY) as UiDensity,
    fontScale: (input.user?.ui_font_scale ?? DEFAULT_UI_FONT_SCALE) as UiFontScale,
    themeCode: hq?.code ?? DEFAULT_UI_THEME_CODE,
    fontCode: font?.code ?? DEFAULT_UI_FONT_PAIR_CODE,
    radius: radius ? { sm: radius.radius_sm, md: radius.radius_md, lg: radius.radius_lg } : { ...DEFAULT_UI_RADIUS },
    seeds: {
      primary: (custom && org?.brand_color_primary) || hq?.brand_color_primary || UI_THEME_SEEDS.STANDARD.primary,
      secondary: (custom && org?.brand_color_secondary) || hq?.brand_color_secondary || UI_THEME_SEEDS.STANDARD.secondary,
    },
    appName: input.whiteLabel ? org?.app_display_name ?? null : null,
    appName2: input.whiteLabel ? org?.app_display_name2 ?? null : null,
    logoUrl: input.logoUrl || null,
  }
}
