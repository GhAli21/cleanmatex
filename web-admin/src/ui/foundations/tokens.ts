/**
 * Theme Tokens - Maps Theme Settings Engine to CSS variables
 * @module ui/foundations/tokens
 */

export interface ThemeConfig {
  accentColor: string
  radiusLevel: 'sm' | 'md' | 'lg'
  density: 'compact' | 'comfortable' | 'spacious'
  highContrast: boolean
  reducedMotion: boolean
}

/**
 * Apply theme tokens to DOM as CSS variables and data attributes
 */
export function applyThemeTokensToDom(config: ThemeConfig) {
  const root = document.documentElement

  // Set data attributes for CSS selectors
  root.setAttribute('data-accent', config.accentColor)
  root.setAttribute('data-radius', config.radiusLevel)
  root.setAttribute('data-density', config.density)

  if (config.highContrast) {
    root.setAttribute('data-high-contrast', 'true')
  } else {
    root.removeAttribute('data-high-contrast')
  }

  if (config.reducedMotion) {
    root.setAttribute('data-reduced-motion', 'true')
  } else {
    root.removeAttribute('data-reduced-motion')
  }
}

/**
 * Default theme configuration
 */
export const defaultThemeConfig: ThemeConfig = {
  accentColor: 'blue',
  radiusLevel: 'md',
  density: 'comfortable',
  highContrast: false,
  reducedMotion: false,
}
