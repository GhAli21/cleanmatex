'use client'

/**
 * AuthConfigField — one catalog item on the Security & Sessions screen.
 *
 * Shows the label/description (bilingual from the DB), where the effective value comes from, the
 * platform default and allowed range, and — when editable — a "use platform default" toggle plus a
 * type-appropriate control (number / switch / select) with inline validation. Pure presentational:
 * all state lives in the screen.
 */

import { useTranslations } from 'next-intl'
import { CmxInput, CmxSelect, CmxSwitch } from '@ui/primitives'
import { Badge } from '@ui/primitives/badge'
import { AUTH_CONFIG_SOURCES, AUTH_CONFIG_VALUE_TYPES } from '@/lib/constants/auth-admin-config'
import type { AuthConfigItem } from '@/lib/types/auth-admin-config'
import { draftError, type AuthConfigDraft } from '../model/auth-config-draft'

interface AuthConfigFieldProps {
  item: AuthConfigItem
  /** Current form state for this item. */
  draft: AuthConfigDraft
  /** true when the user may edit this item right now (plan + permission + item allows tenants). */
  editable: boolean
  locale: string
  onChange: (draft: AuthConfigDraft) => void
}

const SOURCE_BADGE = {
  [AUTH_CONFIG_SOURCES.PLATFORM]: 'secondary',
  [AUTH_CONFIG_SOURCES.TENANT]: 'info',
  [AUTH_CONFIG_SOURCES.PLATFORM_ENFORCED]: 'warning',
} as const

/**
 * @param props - Component props
 * @param props.item - Catalog item resolved for the tenant
 * @param props.draft - Current form state
 * @param props.editable - Whether controls are enabled
 * @param props.locale - Active locale ('ar' picks the Arabic label/description)
 * @param props.onChange - Called with the new draft on any edit
 */
export function AuthConfigField({ item, draft, editable, locale, onChange }: AuthConfigFieldProps) {
  const t = useTranslations('authSession.settings')
  const isAr = locale === 'ar'
  const label = (isAr && item.name2) || item.name
  const description = (isAr && item.description2) || item.description
  const inputId = `auth-config-${item.configCode}`

  const unit = item.unit !== 'NONE' ? t(`units.${item.unit}`) : ''
  const formatValue = (value: string) => {
    if (item.valueType === AUTH_CONFIG_VALUE_TYPES.BOOLEAN) return value === 'true' ? t('on') : t('off')
    if (item.valueType === AUTH_CONFIG_VALUE_TYPES.ENUM) return t.has(`enumValues.${value}`) ? t(`enumValues.${value}`) : value
    return unit ? `${value} ${unit}` : value
  }

  const errorKey = editable ? draftError(item, draft) : undefined
  const errorText =
    errorKey === 'range'
      ? t('errors.range', { min: item.minValue ?? '', max: item.maxValue ?? '' })
      : errorKey
        ? t('errors.invalid')
        : undefined

  const showControl = editable && draft.useCustom

  return (
    <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{label}</h4>
          {description ? (
            <p className="mt-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{description}</p>
          ) : null}
        </div>
        <Badge variant={SOURCE_BADGE[item.source]}>
          {item.isAllowTenantChange || item.source !== AUTH_CONFIG_SOURCES.PLATFORM
            ? t(`source.${item.source}`)
            : t('source.MANAGED')}
        </Badge>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] sm:grid-cols-2">
        <div className="flex gap-1">
          <dt>{t('currentValue')}:</dt>
          <dd className="font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{formatValue(item.effectiveValue)}</dd>
        </div>
        <div className="flex gap-1">
          <dt>{t('platformDefault')}:</dt>
          <dd>{formatValue(item.platformValue)}</dd>
        </div>
        {item.valueType === AUTH_CONFIG_VALUE_TYPES.INTEGER && item.minValue !== null && item.maxValue !== null ? (
          <div className="flex gap-1">
            <dt>{t('allowedRange')}:</dt>
            <dd>{`${item.minValue} – ${item.maxValue}${unit ? ` ${unit}` : ''}`}</dd>
          </div>
        ) : null}
      </dl>

      {item.source === AUTH_CONFIG_SOURCES.PLATFORM_ENFORCED ? (
        <p className="mt-2 text-xs text-amber-700">{t('enforcedHint')}</p>
      ) : null}

      {!item.isAllowTenantChange ? (
        <p className="mt-3 text-xs italic text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('managedHint')}</p>
      ) : editable ? (
        <div className="mt-4 space-y-3 border-t border-[rgb(var(--cmx-border-rgb,226_232_240))] pt-3">
          <CmxSwitch
            size="sm"
            checked={!draft.useCustom}
            onCheckedChange={(usePlatform) => onChange({ ...draft, useCustom: !usePlatform })}
            label={t('usePlatformDefault')}
          />

          {showControl ? (
            <div className="max-w-sm">
              {item.valueType === AUTH_CONFIG_VALUE_TYPES.INTEGER ? (
                <CmxInput
                  id={inputId}
                  type="number"
                  inputMode="numeric"
                  label={t('customValue')}
                  value={draft.text}
                  min={item.minValue ?? undefined}
                  max={item.maxValue ?? undefined}
                  step={1}
                  error={errorText}
                  onChange={(event) => onChange({ ...draft, text: event.target.value })}
                />
              ) : item.valueType === AUTH_CONFIG_VALUE_TYPES.BOOLEAN ? (
                <CmxSwitch
                  size="sm"
                  checked={draft.text === 'true'}
                  onCheckedChange={(on) => onChange({ ...draft, text: on ? 'true' : 'false' })}
                  label={draft.text === 'true' ? t('on') : t('off')}
                />
              ) : (
                <CmxSelect
                  id={inputId}
                  label={t('customValue')}
                  value={draft.text}
                  options={(item.allowedValues ?? []).map((value) => ({ value, label: formatValue(value) }))}
                  error={errorText}
                  onChange={(event) => onChange({ ...draft, text: event.target.value })}
                />
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
