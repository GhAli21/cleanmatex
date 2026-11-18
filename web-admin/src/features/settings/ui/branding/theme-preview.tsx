'use client'

/**
 * Live preview of a theme: the same CSS variables the server writes for the
 * page, scoped to this box, computed by the same colour function.
 * @module features/settings/ui/branding/theme-preview
 */

import type { CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { BRAND_TOKENS, computeBrandPalette, cssVarName } from '@/lib/theme/brand-palette'
import { CmxButton } from '@ui/primitives/cmx-button'

const HEX = /^#[0-9A-Fa-f]{6}$/

/** Props of {@link ThemePreview}. */
export interface ThemePreviewProps {
  primary: string
  secondary: string
  radius: { sm: string; md: string; lg: string }
  /** Seeds used when `primary`/`secondary` are not valid yet (the starting theme's). */
  fallback: { primary: string; secondary: string }
}

/**
 * A small sample of buttons, a link and a card in the given theme.
 * @param props - {@link ThemePreviewProps}
 * @returns The preview box
 */
export function ThemePreview({ primary, secondary, radius, fallback }: ThemePreviewProps) {
  const t = useTranslations('settings')
  const palette = computeBrandPalette(
    HEX.test(primary) ? primary : fallback.primary,
    HEX.test(secondary) ? secondary : fallback.secondary,
  ).LIGHT
  const vars = Object.fromEntries([
    ...BRAND_TOKENS.map((token) => [cssVarName(token), palette[token]]),
    ['--cmx-radius-sm', radius.sm],
    ['--cmx-radius-md', radius.md],
    ['--cmx-radius-lg', radius.lg],
  ]) as CSSProperties

  return (
    <div style={vars} className="space-y-3 rounded-[var(--cmx-radius-lg)] border border-border bg-background p-4" aria-label={t('preview')}>
      <div className="flex flex-wrap gap-2">
        <CmxButton type="button" tabIndex={-1}>{t('primaryButton')}</CmxButton>
        <CmxButton type="button" variant="secondary" tabIndex={-1}>{t('secondaryButton')}</CmxButton>
      </div>
      <div className="rounded-[var(--cmx-radius-md)] border border-border bg-card p-3">
        <p className="font-semibold text-foreground">{t('sampleCard')}</p>
        <p className="text-sm text-muted-foreground">{t('previewText')}</p>
        <span className="text-sm font-medium text-primary-text underline">{t('brandingScreen.sampleLink')}</span>
      </div>
    </div>
  )
}
