import type { ResolvedTheme } from '@/lib/types/ui-theme'

/** The built-in STANDARD appearance, as `DEFAULT_THEME` resolves it. */
export const DEFAULT_THEME_FOR_TEST: ResolvedTheme = {
  mode: 'LIGHT',
  density: 'COMFORTABLE',
  fontScale: 'MD',
  themeCode: 'STANDARD',
  fontCode: 'STANDARD',
  radius: { sm: '0.375rem', md: '0.5rem', lg: '0.75rem' },
  seeds: { primary: '#0AB6D8', secondary: '#0E2A47' },
  appName: null,
  appName2: null,
  logoUrl: null,
}
