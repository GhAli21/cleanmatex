'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, Coins } from 'lucide-react'

import {
  fetchCountableCurrencies,
  fetchEffectiveDenominations,
  saveDenominationOverridesApi,
  type EffectiveDenominationEntry,
} from '@features/cash-drawers/api/cash-denomination-api'
import { useCSRFToken } from '@/lib/hooks/use-csrf-token'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { CmxButton, CmxSelect, CmxSwitch } from '@ui/primitives'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'
import { Badge } from '@ui/primitives/badge'
import { CmxSummaryMessage, cmxMessage } from '@ui/feedback'

interface DraftRow {
  code: string
  isEnabled: boolean
  /** Order override carried from the server; replaced by the grid position once the user reorders. */
  displayOrder: number | null
}

/**
 * Pure: the PUT items for a draft. Untouched order keeps each row's existing override (so enabling or
 * disabling one note never rewrites the order of the others); a reorder stores the visible position of
 * every row, so what the user sees is what the counting grid shows.
 */
export function buildOverrideItems(rows: DraftRow[], reordered: boolean) {
  return rows.map((row, index) => ({
    denominationCode: row.code,
    isEnabled: row.isEnabled,
    displayOrder: reordered ? index : row.displayOrder,
  }))
}

/**
 * Tenant control of counted denominations (C1-1b), shown under the cash-control settings: switch off
 * a note or coin this business does not handle and reorder the counting grid. Nothing changes until
 * Save; counts already recorded are never rewritten. HQ owns the catalog itself.
 */
export function CashDenominationControlCard() {
  const t = useTranslations('billing.cashDrawers.denominations')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const { token: csrfToken } = useCSRFToken()
  const canManage = useHasPermissionCode('cash_control:manage')

  const [currency, setCurrency] = useState('')
  const [draft, setDraft] = useState<{ currency: string; rows: DraftRow[]; reordered: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  const currenciesQuery = useQuery({
    queryKey: ['cash-drawers', 'denominations', 'currencies'],
    queryFn: fetchCountableCurrencies,
    staleTime: 5 * 60_000,
  })
  const selected = currency || currenciesQuery.data?.[0] || ''

  const listQuery = useQuery({
    queryKey: ['cash-drawers', 'denominations', selected],
    enabled: Boolean(selected),
    queryFn: () => fetchEffectiveDenominations(selected),
  })

  const serverRows: EffectiveDenominationEntry[] = listQuery.data ?? []
  const rows: DraftRow[] =
    draft && draft.currency === selected
      ? draft.rows
      : serverRows.map((r) => ({ code: r.denominationCode, isEnabled: r.isEnabled, displayOrder: r.displayOrderOverride }))
  const reordered = draft?.currency === selected ? draft.reordered : false
  const isDirty = draft?.currency === selected
  const byCode = new Map(serverRows.map((r) => [r.denominationCode, r]))
  const allOff = rows.length > 0 && rows.every((r) => !r.isEnabled)

  const update = (next: DraftRow[], nextReordered: boolean) => setDraft({ currency: selected, rows: next, reordered: nextReordered })

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    ;[next[index], next[target]] = [next[target], next[index]]
    update(next, true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await saveDenominationOverridesApi({
        currencyCode: selected,
        items: buildOverrideItems(rows, reordered),
        csrfToken,
      })
      cmxMessage.success(t('saved'))
      setDraft(null)
      await queryClient.invalidateQueries({ queryKey: ['cash-drawers', 'denominations'] })
    } catch {
      cmxMessage.error(t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const resetToHq = () =>
    update(
      serverRows.map((r) => ({ code: r.denominationCode, isEnabled: true, displayOrder: null })),
      false,
    )

  return (
    <div className="max-w-4xl p-6 pt-0">
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" aria-hidden />
            {t('title')}
          </CmxCardTitle>
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('description')}</p>
        </CmxCardHeader>
        <CmxCardContent className="space-y-4">
          {currenciesQuery.data && currenciesQuery.data.length === 0 ? (
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('noCurrencies')}</p>
          ) : (
            <div className="max-w-xs">
              <CmxSelect
                label={t('currency')}
                value={selected}
                onChange={(event) => {
                  setCurrency(event.target.value)
                  setDraft(null)
                }}
                options={(currenciesQuery.data ?? []).map((code) => ({ value: code, label: code }))}
              />
            </div>
          )}

          {allOff ? <CmxSummaryMessage type="warning" title={t('allOffTitle')} items={[t('allOffBody')]} /> : null}

          <ul className="divide-y rounded-lg border">
            {rows.map((row, index) => {
              const info = byCode.get(row.code)
              if (!info) return null
              const label = locale === 'ar' && info.name2 ? info.name2 : info.name
              return (
                <li key={row.code} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${row.isEnabled ? '' : 'text-muted-foreground line-through'}`}>{label}</p>
                    <p className="text-xs text-muted-foreground">
                      <Badge variant="outline">{info.denomKind === 'COIN' ? t('coin') : t('note')}</Badge>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CmxButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={!canManage || index === 0}
                      aria-label={t('moveUp')}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </CmxButton>
                    <CmxButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={!canManage || index === rows.length - 1}
                      aria-label={t('moveDown')}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </CmxButton>
                    <CmxSwitch
                      checked={row.isEnabled}
                      disabled={!canManage}
                      aria-label={t('accepted')}
                      onCheckedChange={(value) =>
                        update(
                          rows.map((r) => (r.code === row.code ? { ...r, isEnabled: value } : r)),
                          reordered,
                        )
                      }
                    />
                  </div>
                </li>
              )
            })}
          </ul>

          {canManage ? (
            <div className="flex items-center gap-3 border-t pt-4">
              <CmxButton type="button" size="sm" disabled={!isDirty} loading={saving} onClick={save}>
                {tCommon('save')}
              </CmxButton>
              <CmxButton type="button" size="sm" variant="ghost" disabled={saving} onClick={resetToHq}>
                {t('resetToHq')}
              </CmxButton>
              {isDirty ? (
                <CmxButton type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setDraft(null)}>
                  {tCommon('cancel')}
                </CmxButton>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t('viewOnly')}</p>
          )}
        </CmxCardContent>
      </CmxCard>
    </div>
  )
}
