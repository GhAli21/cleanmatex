/**
 * Appearance codes and values. Stored UPPERCASE, identical in the database
 * (`sys_ui_*_cd`, `org_tenant_ui_theme_dtl`, `sys_users_mst.ui_*`), here and
 * in the `<html data-*>` attributes.
 *
 * Theme, radius and font pair codes are HQ data: HQ can add rows without a
 * deploy, so only the defaults are constants, not closed lists.
 *
 * @module lib/constants/ui-theme
 */

/** `sys_users_mst.ui_color_mode` and `<html data-mode>`. */
export const UI_COLOR_MODES = ['LIGHT', 'DARK', 'SYSTEM'] as const
export type UiColorMode = (typeof UI_COLOR_MODES)[number]

/** `ui_density` (user) and `default_ui_density` (Organization); `<html data-density>`. */
export const UI_DENSITIES = ['COMFORTABLE', 'COMPACT'] as const
export type UiDensity = (typeof UI_DENSITIES)[number]

/** `sys_users_mst.ui_font_scale` and `<html data-font-scale>`. */
export const UI_FONT_SCALES = ['SM', 'MD', 'LG'] as const
export type UiFontScale = (typeof UI_FONT_SCALES)[number]

/** `sys_users_mst.ui_sidebar_theme` and `<aside data-sidebar-theme>`. */
export const UI_SIDEBAR_THEMES = ['OCEAN', 'MIDNIGHT', 'EMERALD', 'INDIGO', 'SAND'] as const
export type UiSidebarTheme = (typeof UI_SIDEBAR_THEMES)[number]

/** Maximum number of pinned sidebar items allowed per tenant per user. */
export const MAX_SIDEBAR_PINS_PER_TENANT = 12

/** Used when an Organization has chosen nothing, and whenever resolution fails. */
export const DEFAULT_UI_THEME_CODE = 'STANDARD'
export const DEFAULT_UI_RADIUS_CODE = 'STANDARD'
export const DEFAULT_UI_FONT_PAIR_CODE = 'STANDARD'
export const DEFAULT_UI_COLOR_MODE: UiColorMode = 'SYSTEM'
export const DEFAULT_UI_DENSITY: UiDensity = 'COMFORTABLE'
export const DEFAULT_UI_FONT_SCALE: UiFontScale = 'MD'
export const DEFAULT_UI_SIDEBAR_THEME: UiSidebarTheme = 'OCEAN'

/** STANDARD radius preset (0752 seed, equal to tokens.css); used when the catalog cannot be read. */
export const DEFAULT_UI_RADIUS = { sm: '0.375rem', md: '0.5rem', lg: '0.75rem' } as const

/** Shape of every HQ catalog code (`sys_ui_theme_cd.code` etc.). */
export const UI_CATALOG_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,29}$/

/**
 * Seeds of the HQ themes seeded by the catalog migration (design 6.3). The
 * migration mirrors these values; the palette test proves each pair readable.
 */
export const UI_THEME_SEEDS = {
  STANDARD: { primary: '#0AB6D8', secondary: '#0E2A47' },
  OCEAN: { primary: '#2563EB', secondary: '#0F172A' },
  EMERALD: { primary: '#059669', secondary: '#064E3B' },
  TEAL: { primary: '#0D9488', secondary: '#134E4A' },
  ROYAL: { primary: '#7C3AED', secondary: '#1E1B4B' },
  ROSE: { primary: '#E11D48', secondary: '#4C0519' },
  SUNSET: { primary: '#EA580C', secondary: '#7C2D12' },
  GOLD: { primary: '#B45309', secondary: '#451A03' },
  SLATE: { primary: '#475569', secondary: '#0F172A' },
  GRAPHITE: { primary: '#18181B', secondary: '#52525B' },
} as const satisfies Record<string, { primary: string; secondary: string }>
