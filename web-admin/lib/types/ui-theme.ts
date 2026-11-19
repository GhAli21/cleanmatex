/**
 * Types of the theme runtime (UI Design System PR-07).
 * @module lib/types/ui-theme
 */

import type { UiColorMode, UiDensity, UiFontScale } from '@/lib/constants/ui-theme'

/** Everything the server needs to render one page's appearance. */
export interface ResolvedTheme {
  /** `<html data-mode>`: the person's choice; SYSTEM (follow the device) when signed out. */
  mode: UiColorMode
  density: UiDensity
  fontScale: UiFontScale
  /** HQ theme the values come from. */
  themeCode: string
  /** Font pair code, written as `<html data-font>`. */
  fontCode: string
  /** CSS lengths for --cmx-radius-sm/md/lg. */
  radius: { sm: string; md: string; lg: string }
  /** `#RRGGBB` brand seeds fed to `computeBrandPalette`. */
  seeds: { primary: string; secondary: string }
  /** White-label app name (EN / AR); null = "CleanMateX". */
  appName: string | null
  appName2: string | null
  /** Published MAIN logo (`org_tenants_mst.logo_url`, kept by File Util); null = no logo. All plans. */
  logoUrl: string | null
}
