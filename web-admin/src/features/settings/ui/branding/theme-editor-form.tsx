'use client'

/**
 * Create / edit one saved theme: name, starting HQ theme, plan-gated overrides
 * (colours, corners, font; app name), default density, and a live preview.
 * Controls the plan does not include are disabled with the reason. When a colour
 * is unreadable as text, the notice beside it says so as it is entered.
 * @module features/settings/ui/branding/theme-editor-form
 */

import { useId, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { seedAdjustments } from '@/lib/theme/brand-palette'
import { UI_DENSITIES } from '@/lib/constants/ui-theme'
import type { OrgThemeInput } from '@/lib/validations/ui-theme'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxInput } from '@ui/primitives/cmx-input'
import { CmxHexColorField } from '@ui/forms/cmx-hex-color-field'
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms/cmx-select-dropdown'
import { ThemePreview } from './theme-preview'

const HEX = /^#[0-9A-Fa-f]{6}$/

/** HQ catalogs as returned by GET /api/v1/settings/branding. */
export interface BrandingCatalog {
  themes: Array<{
    code: string; name: string; name2: string | null; description: string | null; description2: string | null
    brand_color_primary: string; brand_color_secondary: string; ui_radius_code: string; ui_font_pair_code: string; is_default: boolean
  }>
  radii: Array<{ code: string; name: string; name2: string | null; radius_sm: string; radius_md: string; radius_lg: string; is_default: boolean }>
  fonts: Array<{ code: string; name: string; name2: string | null; font_family_en: string; font_family_ar: string; is_default: boolean }>
}

/** What the plan allows (display only; the server checks again). */
export interface BrandingPlan {
  customBranding: boolean
  whiteLabel: boolean
}

/** Props of {@link ThemeEditorForm}. */
export interface ThemeEditorFormProps {
  catalog: BrandingCatalog
  plan: BrandingPlan
  /** Theme being edited, or null for a new one. */
  initial: OrgThemeInput | null
  saving: boolean
  /** Server field errors to show inline. */
  fieldErrors?: Record<string, string>
  onSubmit: (input: OrgThemeInput) => void
  onCancel: () => void
}

type Draft = Record<keyof OrgThemeInput, string>

const toDraft = (v: OrgThemeInput | null, defaultTheme: string): Draft => ({
  theme_name: v?.theme_name ?? '',
  theme_name2: v?.theme_name2 ?? '',
  ui_theme_code: v?.ui_theme_code ?? defaultTheme,
  brand_color_primary: v?.brand_color_primary ?? '',
  brand_color_secondary: v?.brand_color_secondary ?? '',
  ui_radius_code: v?.ui_radius_code ?? '',
  ui_font_pair_code: v?.ui_font_pair_code ?? '',
  default_ui_density: v?.default_ui_density ?? '',
  app_display_name: v?.app_display_name ?? '',
  app_display_name2: v?.app_display_name2 ?? '',
})

const orNull = (s: string) => (s.trim() ? s.trim() : null)

/**
 * The saved-theme form.
 * @param props - {@link ThemeEditorFormProps}
 * @returns The form
 */
export function ThemeEditorForm({ catalog, plan, initial, saving, fieldErrors = {}, onSubmit, onCancel }: ThemeEditorFormProps) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const isAr = useLocale() === 'ar'
  const label = (row: { name: string; name2: string | null }) => (isAr && row.name2) || row.name
  const defaultTheme = catalog.themes.find((x) => x.is_default)?.code ?? catalog.themes[0]?.code ?? 'STANDARD'
  const [d, setD] = useState<Draft>(() => toDraft(initial, defaultTheme))
  const [nameError, setNameError] = useState<string | null>(null)
  const set = (key: keyof Draft) => (value: string) => setD((prev) => ({ ...prev, [key]: value }))

  const base = catalog.themes.find((x) => x.code === d.ui_theme_code) ?? catalog.themes[0]
  const fallback = { primary: base?.brand_color_primary ?? '#0AB6D8', secondary: base?.brand_color_secondary ?? '#0E2A47' }
  const primary = HEX.test(d.brand_color_primary) ? d.brand_color_primary : fallback.primary
  const secondary = HEX.test(d.brand_color_secondary) ? d.brand_color_secondary : fallback.secondary
  const adjusted = seedAdjustments(primary, secondary)
  const radiusRow = catalog.radii.find((r) => r.code === (d.ui_radius_code || base?.ui_radius_code)) ?? catalog.radii[0]
  const radius = radiusRow ? { sm: radiusRow.radius_sm, md: radiusRow.radius_md, lg: radiusRow.radius_lg } : { sm: '0.375rem', md: '0.5rem', lg: '0.75rem' }

  const submit = () => {
    if (!d.theme_name.trim()) {
      setNameError(t('brandingScreen.nameRequired'))
      return
    }
    onSubmit({
      theme_name: d.theme_name.trim(),
      theme_name2: orNull(d.theme_name2),
      ui_theme_code: d.ui_theme_code,
      default_ui_density: orNull(d.default_ui_density) as OrgThemeInput['default_ui_density'],
      // Fields outside the plan are left out, so the server keeps what is stored (for an upgrade).
      ...(plan.customBranding && {
        brand_color_primary: orNull(d.brand_color_primary),
        brand_color_secondary: orNull(d.brand_color_secondary),
        ui_radius_code: orNull(d.ui_radius_code),
        ui_font_pair_code: orNull(d.ui_font_pair_code),
      }),
      ...(plan.whiteLabel && {
        app_display_name: orNull(d.app_display_name),
        app_display_name2: orNull(d.app_display_name2),
      }),
    })
  }

  return (
    <form
      className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem]"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <CmxInput label={t('brandingScreen.themeName')} value={d.theme_name} onChange={(e) => { set('theme_name')(e.target.value); setNameError(null) }} error={nameError ?? fieldErrors.theme_name} maxLength={80} />
          <CmxInput label={t('brandingScreen.themeName2')} value={d.theme_name2} onChange={(e) => set('theme_name2')(e.target.value)} dir="rtl" maxLength={80} />
        </div>

        <SelectField
          label={t('brandingScreen.baseTheme')}
          hint={t('brandingScreen.baseThemeHint')}
          value={d.ui_theme_code}
          onChange={set('ui_theme_code')}
          options={catalog.themes.map((x) => ({ value: x.code, label: label(x), swatch: x.brand_color_primary }))}
        />

        <fieldset className="space-y-4 rounded-[var(--cmx-radius-lg)] border border-border p-4" disabled={!plan.customBranding}>
          <legend className="px-1 text-sm font-semibold text-foreground">{t('brandingScreen.overrides')}</legend>
          {!plan.customBranding ? <p className="text-sm text-muted-foreground">{t('brandingScreen.notInPlanBranding')}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <CmxHexColorField
                label={t('primaryColor')}
                value={d.brand_color_primary}
                onChange={set('brand_color_primary')}
                disabled={!plan.customBranding}
                clearLabel={t('brandingScreen.useThemeValue')}
                pickerAriaLabel={`${t('primaryColor')} — ${t('brandingScreen.picker')}`}
                hexPlaceholder={fallback.primary}
                invalidMessage={t('colors.invalid')}
              />
              {plan.customBranding && adjusted.primary && HEX.test(d.brand_color_primary) ? (
                <p className="mt-1 text-xs text-warning-text">{t('brandingScreen.colorAdjusted')}</p>
              ) : null}
            </div>
            <div>
              <CmxHexColorField
                label={t('secondaryColor')}
                value={d.brand_color_secondary}
                onChange={set('brand_color_secondary')}
                disabled={!plan.customBranding}
                clearLabel={t('brandingScreen.useThemeValue')}
                pickerAriaLabel={`${t('secondaryColor')} — ${t('brandingScreen.picker')}`}
                hexPlaceholder={fallback.secondary}
                invalidMessage={t('colors.invalid')}
              />
              {plan.customBranding && adjusted.secondary && HEX.test(d.brand_color_secondary) ? (
                <p className="mt-1 text-xs text-warning-text">{t('brandingScreen.colorAdjusted')}</p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t('brandingScreen.radius')}
              value={d.ui_radius_code}
              onChange={set('ui_radius_code')}
              disabled={!plan.customBranding}
              options={[{ value: '', label: t('brandingScreen.useThemeValue') }, ...catalog.radii.map((r) => ({ value: r.code, label: label(r) }))]}
            />
            <SelectField
              label={t('brandingScreen.font')}
              value={d.ui_font_pair_code}
              onChange={set('ui_font_pair_code')}
              disabled={!plan.customBranding}
              options={[{ value: '', label: t('brandingScreen.useThemeValue') }, ...catalog.fonts.map((f) => ({ value: f.code, label: label(f) }))]}
            />
          </div>
        </fieldset>

        <SelectField
          label={t('brandingScreen.density')}
          hint={t('brandingScreen.densityHint')}
          value={d.default_ui_density}
          onChange={set('default_ui_density')}
          options={[
            { value: '', label: t('brandingScreen.densityDefault') },
            ...UI_DENSITIES.map((v) => ({ value: v, label: t(`brandingScreen.densityOptions.${v}`) })),
          ]}
        />

        <fieldset className="space-y-3 rounded-[var(--cmx-radius-lg)] border border-border p-4" disabled={!plan.whiteLabel}>
          <legend className="px-1 text-sm font-semibold text-foreground">{t('brandingScreen.appNameTitle')}</legend>
          {!plan.whiteLabel ? <p className="text-sm text-muted-foreground">{t('brandingScreen.notInPlanWhiteLabel')}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <CmxInput label={t('brandingScreen.appName')} value={d.app_display_name} onChange={(e) => set('app_display_name')(e.target.value)} disabled={!plan.whiteLabel} maxLength={80} />
            <CmxInput label={t('brandingScreen.appName2')} value={d.app_display_name2} onChange={(e) => set('app_display_name2')(e.target.value)} disabled={!plan.whiteLabel} dir="rtl" maxLength={80} />
          </div>
          <p className="text-xs text-muted-foreground">{t('brandingScreen.appNameHint')}</p>
        </fieldset>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">{t('preview')}</p>
        <ThemePreview primary={primary} secondary={secondary} radius={radius} fallback={fallback} />
      </div>

      <div className="flex justify-end gap-2 md:col-span-2">
        <CmxButton type="button" variant="outline" onClick={onCancel} disabled={saving}>{tCommon('cancel')}</CmxButton>
        <CmxButton type="submit" loading={saving}>{tCommon('save')}</CmxButton>
      </div>
    </form>
  )
}

/** A labelled single select on top of CmxSelectDropdown. */
function SelectField({
  label,
  hint,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string; swatch?: string }>
  disabled?: boolean
}) {
  const id = useId()
  const current = options.find((o) => o.value === value)
  return (
    <div className="space-y-1.5">
      <span id={id} className="block text-sm font-medium text-foreground">{label}</span>
      <CmxSelectDropdown value={value} onValueChange={onChange} disabled={disabled}>
        <CmxSelectDropdownTrigger aria-labelledby={id}>
          <CmxSelectDropdownValue displayValue={current?.label} />
        </CmxSelectDropdownTrigger>
        <CmxSelectDropdownContent>
          {options.map((o) => (
            <CmxSelectDropdownItem key={o.value || 'none'} value={o.value}>
              <span className="flex items-center gap-2">
                {/* swatch: the theme's own seed colour, shown as data */}
                {o.swatch ? <span aria-hidden="true" className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: o.swatch }} /> : null}
                {o.label}
              </span>
            </CmxSelectDropdownItem>
          ))}
        </CmxSelectDropdownContent>
      </CmxSelectDropdown>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
