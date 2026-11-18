'use client'

/**
 * Account → Appearance: the signed-in person's own density and text size,
 * stored on their user record so they follow them to every device. The colour
 * mode choice appears here once dark mode is offered (PR-07 task 6).
 * @module features/auth-session/ui/account-appearance-screen
 */

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCSRFToken } from '@/lib/utils/csrf-token'
import { UI_DENSITIES, UI_FONT_SCALES } from '@/lib/constants/ui-theme'
import type { UiPreferencesInput } from '@/lib/validations/ui-theme'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxCard, CmxCardContent, CmxCardHeader } from '@ui/primitives/cmx-card'
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms/cmx-select-dropdown'
import { cmxMessage } from '@ui/feedback'

const URL = '/api/v1/me/ui-preferences'
const KEY = ['me', 'ui-preferences'] as const
type Prefs = { ui_color_mode: string; ui_density: string | null; ui_font_scale: string }

async function load(): Promise<Prefs> {
  const res = await fetch(URL, { credentials: 'include' })
  if (!res.ok) throw new Error(`Failed (${res.status})`)
  return (await res.json()).data
}

async function save(input: UiPreferencesInput): Promise<Prefs> {
  const token = await getCSRFToken()
  const res = await fetch(URL, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-CSRF-Token': token } : {}) },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Failed (${res.status})`)
  return (await res.json()).data
}

/** @returns The appearance screen */
export function AccountAppearanceScreen() {
  const t = useTranslations('authSession.appearance')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: KEY, queryFn: load })
  // Only the user's unsaved edits are state; shown values fall back to the saved ones.
  const [draft, setDraft] = useState<{ density?: string; fontScale?: string }>({})
  // '' = follow the Organization (stored as NULL).
  const density = draft.density ?? query.data?.ui_density ?? ''
  const fontScale = draft.fontScale ?? query.data?.ui_font_scale ?? 'MD'
  const setDensity = (v: string) => setDraft((d) => ({ ...d, density: v }))
  const setFontScale = (v: string) => setDraft((d) => ({ ...d, fontScale: v }))

  const mutation = useMutation({
    mutationFn: save,
    onSuccess: (saved) => {
      queryClient.setQueryData(KEY, saved)
      setDraft({})
      cmxMessage.success(t('saved'))
      router.refresh() // the server re-renders <html data-density/data-font-scale>
    },
    onError: () => cmxMessage.error(t('saveError')),
  })

  const dirty =
    query.data && (density !== (query.data.ui_density ?? '') || fontScale !== query.data.ui_font_scale)

  return (
    <CmxCard className="max-w-2xl">
      <CmxCardHeader>
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </CmxCardHeader>
      <CmxCardContent className="space-y-5">
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground" role="status">{tCommon('loading')}</p>
        ) : query.isError ? (
          <div className="flex items-center justify-between gap-3" role="alert">
            <p className="text-sm text-danger-text">{t('loadError')}</p>
            <CmxButton type="button" variant="outline" onClick={() => void query.refetch()}>{tCommon('retry')}</CmxButton>
          </div>
        ) : (
          <>
            <Choice
              label={t('density')}
              hint={t('densityHint')}
              value={density}
              onChange={setDensity}
              options={[{ value: '', label: t('densityFollow') }, ...UI_DENSITIES.map((v) => ({ value: v, label: t(`densityOptions.${v}`) }))]}
            />
            <Choice
              label={t('fontScale')}
              value={fontScale}
              onChange={setFontScale}
              options={UI_FONT_SCALES.map((v) => ({ value: v, label: t(`fontScaleOptions.${v}`) }))}
            />
            <div className="flex justify-end">
              <CmxButton
                type="button"
                disabled={!dirty}
                loading={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    ui_density: (density || null) as UiPreferencesInput['ui_density'],
                    ui_font_scale: fontScale as UiPreferencesInput['ui_font_scale'],
                  })
                }
              >
                {tCommon('save')}
              </CmxButton>
            </div>
          </>
        )}
      </CmxCardContent>
    </CmxCard>
  )
}

function Choice({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <span id={id} className="block text-sm font-medium text-foreground">{label}</span>
      <CmxSelectDropdown value={value} onValueChange={onChange}>
        <CmxSelectDropdownTrigger aria-labelledby={id}>
          <CmxSelectDropdownValue displayValue={options.find((o) => o.value === value)?.label} />
        </CmxSelectDropdownTrigger>
        <CmxSelectDropdownContent>
          {options.map((o) => (
            <CmxSelectDropdownItem key={o.value || 'follow'} value={o.value}>{o.label}</CmxSelectDropdownItem>
          ))}
        </CmxSelectDropdownContent>
      </CmxSelectDropdown>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
