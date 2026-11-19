/**
 * The page's theme `<style>` block. It holds only what differs from the static
 * tokens.css (generated from STANDARD), using the same selectors so it overrides it.
 * Every value is re-checked here, because it is written into the page as CSS.
 *
 * @module lib/theme/theme-style
 */

import { BRAND_TOKENS, computeBrandPalette, cssVarName, type ThemeMode } from '@/lib/theme/brand-palette'
import { DEFAULT_UI_RADIUS, UI_THEME_SEEDS } from '@/lib/constants/ui-theme'
import type { ResolvedTheme } from '@/lib/types/ui-theme'

const HEX = /^#[0-9A-Fa-f]{6}$/
const LENGTH = /^[0-9]+(\.[0-9]+)?(px|rem)$/

/**
 * CSS for one resolved theme; '' when it equals STANDARD (tokens.css already applies).
 * @param theme - Resolved theme
 * @returns CSS text, safe to place in a `<style>` element
 */
export function themeStyleCss(theme: ResolvedTheme): string {
  const std = UI_THEME_SEEDS.STANDARD
  const primary = HEX.test(theme.seeds.primary) ? theme.seeds.primary.toUpperCase() : std.primary
  const secondary = HEX.test(theme.seeds.secondary) ? theme.seeds.secondary.toUpperCase() : std.secondary
  const sizes = [theme.radius.sm, theme.radius.md, theme.radius.lg]
  const radius = sizes.every((v) => LENGTH.test(v)) ? sizes : [DEFAULT_UI_RADIUS.sm, DEFAULT_UI_RADIUS.md, DEFAULT_UI_RADIUS.lg]

  const customColours = primary !== std.primary || secondary !== std.secondary
  const customRadius = radius.join() !== [DEFAULT_UI_RADIUS.sm, DEFAULT_UI_RADIUS.md, DEFAULT_UI_RADIUS.lg].join()
  if (!customColours && !customRadius) return ''

  const radiusVars = customRadius
    ? `--cmx-radius-sm:${radius[0]};--cmx-radius-md:${radius[1]};--cmx-radius-lg:${radius[2]};`
    : ''
  if (!customColours) return `:root{${radiusVars}}`

  const palette = computeBrandPalette(primary, secondary)
  const vars = (mode: ThemeMode) => BRAND_TOKENS.map((t) => `${cssVarName(t)}:${palette[mode][t]};`).join('')
  return (
    // Same selectors as tokens.css: dark only on screen (paper stays light); LIGHT also forces a light subtree.
    `:root,[data-mode=LIGHT]{${vars('LIGHT')}${radiusVars}}` +
    `@media screen{[data-mode=DARK]{${vars('DARK')}}}` +
    `@media screen and (prefers-color-scheme: dark){[data-mode=SYSTEM]{${vars('DARK')}}}`
  )
}
