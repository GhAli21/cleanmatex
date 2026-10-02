'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import {
  fetchCashDrawerCatalogs,
  fetchSessionClosure,
  updateSessionPostClose,
  type SessionClosureCountView,
} from '@features/cash-drawers/api/cash-drawer-api'
import {
  CashDrawerInfoTile,
  useCashDrawerDateFormatter,
  useCashDrawerMoneyFormatter,
} from '@features/cash-drawers/ui/cash-drawer-ui-parts'
import { useCSRFToken } from '@lib/hooks/use-csrf-token'
import { useTenantCurrency } from '@lib/context/tenant-currency-context'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { cmxMessage } from '@ui/feedback'
import { CmxMoneyVariance } from '@ui/data-display'
import { CmxButton, CmxSelect, CmxSkeleton, CmxTextarea, Label } from '@ui/primitives'
import { Badge } from '@ui/primitives/badge'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'

const CLOSED_STATUSES = ['CLOSED', 'FORCE_CLOSED']

/**
 * Session-detail closure section (CLF-8-8): per-currency balances, count
 * history with denominations, the disposition of the closing cash, and the
 * post-close follow-up panel (status + notes editor, change log).
 * @param props component props
 * @param props.drawerId drawer the session belongs to
 * @param props.sessionId session shown
 */
export function CashDrawerSessionClosureSection({ drawerId, sessionId }: { drawerId: string; sessionId: string }) {
  const t = useTranslations('billing.cashDrawers.closure')
  const tDrawers = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const money = useCashDrawerMoneyFormatter()
  const fmtDateTime = useCashDrawerDateFormatter()
  const queryClient = useQueryClient()
  const { token: csrfToken } = useCSRFToken()
  const { decimalPlaces } = useTenantCurrency()
  const canUpdatePostClose = useHasPermissionCode('cash_drawer:post_close_update')

  const queryKey = ['cash-drawers', drawerId, 'session', sessionId, 'closure']
  const closureQuery = useQuery({ queryKey, queryFn: () => fetchSessionClosure(drawerId, sessionId) })
  const catalogsQuery = useQuery({
    queryKey: ['cash-drawers', 'catalogs'],
    queryFn: fetchCashDrawerCatalogs,
    staleTime: 5 * 60_000,
  })

  const [statusDraft, setStatusDraft] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const localized = (row: { name: string; name2: string | null } | undefined, fallback: string) =>
    row ? (locale === 'ar' && row.name2 ? row.name2 : row.name) : fallback

  if (closureQuery.isLoading) return <CmxSkeleton className="h-40 w-full" />
  if (closureQuery.isError || !closureQuery.data) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
        <span>{t('loadFailed')}</span>
        <CmxButton size="sm" variant="outline" onClick={() => closureQuery.refetch()}>
          {tCommon('retry')}
        </CmxButton>
      </div>
    )
  }

  const view = closureQuery.data
  const isClosed = CLOSED_STATUSES.includes(view.status)
  const catalogs = catalogsQuery.data
  const postCloseStatuses = catalogs?.postCloseStatuses ?? []
  const statusRow = (code: string | null) => postCloseStatuses.find((s) => s.code === code)
  const currentStatus = statusDraft ?? view.postClose.statusCode ?? ''
  const currentNotes = notesDraft ?? view.postClose.notes ?? ''
  const selectedStatus = statusRow(currentStatus)

  const dispositionLabel = (code: string | null) =>
    code ? localized(catalogs?.dispositions.find((d) => d.code === code), code) : '—'

  const savePostClose = async () => {
    if (!currentStatus) {
      cmxMessage.error(t('postClose.statusRequired'))
      return
    }
    if (selectedStatus?.requiresNotes && !currentNotes.trim()) {
      cmxMessage.error(t('postClose.notesRequired'))
      return
    }
    setSaving(true)
    try {
      await updateSessionPostClose({
        drawerId,
        sessionId,
        postCloseStatusCode: currentStatus,
        notes: currentNotes.trim() || undefined,
        csrfToken,
      })
      cmxMessage.success(t('postClose.saved'))
      setStatusDraft(null)
      setNotesDraft(null)
      await queryClient.invalidateQueries({ queryKey })
    } catch (error) {
      cmxMessage.error(error instanceof Error ? error.message : t('postClose.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const varianceBadge = (amount: string, currency: string) => (
    <CmxMoneyVariance
      amount={Number(amount)}
      formattedAmount={money(Math.abs(Number(amount)), currency)}
      labels={{ over: tDrawers('over'), short: tDrawers('short'), balanced: tDrawers('balanced') }}
      size="sm"
    />
  )

  const countsByCurrency = (currency: string): SessionClosureCountView[] =>
    view.counts.filter((c) => c.currencyCode === currency)

  return (
    <div className="space-y-4">
      {view.balances.length === 0 ? (
        <CmxCard>
          <CmxCardContent className="p-4 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('noBalances')}
          </CmxCardContent>
        </CmxCard>
      ) : (
        view.balances.map((b) => (
          <CmxCard key={b.currencyCode}>
            <CmxCardHeader>
              <CmxCardTitle>{t('balanceTitle', { currency: b.currencyCode })}</CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <CashDrawerInfoTile label={t('openingExpected')} value={money(b.openingExpected, b.currencyCode)} />
                <CashDrawerInfoTile label={t('financeIn')} value={money(b.finIn, b.currencyCode)} />
                <CashDrawerInfoTile label={t('financeOut')} value={money(b.finOut, b.currencyCode)} />
                <CashDrawerInfoTile label={t('custodyIn')} value={money(b.trxIn, b.currencyCode)} />
                <CashDrawerInfoTile label={t('custodyOut')} value={money(b.trxOut, b.currencyCode)} />
                <CashDrawerInfoTile
                  label={t('closingExpected')}
                  value={b.closingExpected !== null ? money(b.closingExpected, b.currencyCode) : '—'}
                />
                <CashDrawerInfoTile
                  label={t('closingCounted')}
                  value={b.closingCounted !== null ? money(b.closingCounted, b.currencyCode) : '—'}
                />
                <div className="flex items-center rounded-lg border p-4">
                  {b.closingVariance !== null ? varianceBadge(b.closingVariance, b.currencyCode) : '—'}
                </div>
              </div>

              {b.dispositionCode ? (
                <div className="space-y-2 rounded-xl border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
                  <div className="text-sm font-semibold">{t('disposition')}</div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline">{dispositionLabel(b.dispositionCode)}</Badge>
                    {b.dispositionDestDrawerName ? (
                      <span>{t('dispositionDestination', { drawer: b.dispositionDestDrawerName })}</span>
                    ) : null}
                    {b.dispositionKeptAmount !== null ? (
                      <span>{t('dispositionKept', { amount: money(b.dispositionKeptAmount, b.currencyCode) })}</span>
                    ) : null}
                  </div>
                  {b.dispositionNotes ? (
                    <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{b.dispositionNotes}</p>
                  ) : null}
                </div>
              ) : null}

              {countsByCurrency(b.currencyCode).length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">{t('countHistory')}</div>
                  {countsByCurrency(b.currencyCode).map((c) => (
                    <details key={c.countId} className="rounded-lg border p-3 text-sm">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                        <Badge variant="outline">{tDrawers(`tabs.counts.types.${c.countType}` as Parameters<typeof tDrawers>[0])}</Badge>
                        <span>{fmtDateTime(c.countedAt)}</span>
                        <span>
                          {t('countedOfExpected', {
                            counted: money(c.countedAmount, c.currencyCode),
                            expected: money(c.expectedAmount, c.currencyCode),
                          })}
                        </span>
                        {varianceBadge(c.varianceAmount, c.currencyCode)}
                      </summary>
                      <div className="mt-3 space-y-1">
                        {c.denominations.length > 0 ? (
                          c.denominations.map((d, i) => (
                            <div key={`${c.countId}-${i}`} className="flex justify-between gap-4">
                              <span>
                                {money(d.valueMinor / 10 ** decimalPlaces, c.currencyCode)} × {d.quantity}
                              </span>
                              <span>{money(d.lineAmount, c.currencyCode)}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('totalOnlyCount')}</p>
                        )}
                        {c.notes ? <p className="italic">{c.notes}</p> : null}
                      </div>
                    </details>
                  ))}
                </div>
              ) : null}
            </CmxCardContent>
          </CmxCard>
        ))
      )}

      {isClosed ? (
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('postClose.title')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('postClose.current')}</span>
              <Badge variant="outline">
                {view.postClose.statusCode
                  ? localized(statusRow(view.postClose.statusCode), view.postClose.statusCode)
                  : t('postClose.none')}
              </Badge>
              {view.postClose.at ? <span>{fmtDateTime(view.postClose.at)}</span> : null}
            </div>

            {canUpdatePostClose ? (
              <div className="space-y-3">
                <CmxSelect
                  label={t('postClose.status')}
                  value={currentStatus}
                  onChange={(event) => setStatusDraft(event.target.value)}
                  options={[
                    { value: '', label: t('postClose.selectStatus') },
                    ...postCloseStatuses.map((s) => ({ value: s.code, label: localized(s, s.code) })),
                  ]}
                />
                <div className="space-y-2">
                  <Label>{selectedStatus?.requiresNotes ? t('postClose.notes') : t('postClose.notesOptional')}</Label>
                  <CmxTextarea value={currentNotes} onChange={(event) => setNotesDraft(event.target.value)} />
                </div>
                <div className="flex justify-end">
                  <CmxButton loading={saving} onClick={savePostClose}>
                    {t('postClose.save')}
                  </CmxButton>
                </div>
              </div>
            ) : null}

            {view.postClose.history.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold">{t('postClose.history')}</div>
                <ul className="space-y-1 text-sm">
                  {view.postClose.history.map((h, i) => (
                    <li key={`${h.changedAt}-${i}`} className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{localized(statusRow(h.statusCode), h.statusCode)}</Badge>
                      <span>{fmtDateTime(h.changedAt)}</span>
                      {h.notes ? <span className="italic">— {h.notes}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CmxCardContent>
        </CmxCard>
      ) : null}
    </div>
  )
}
