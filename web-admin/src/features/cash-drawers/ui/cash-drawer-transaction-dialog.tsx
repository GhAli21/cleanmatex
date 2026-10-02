'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import {
  fetchCashDrawerCatalogs,
  fetchCashDrawersWithCurrentSession,
  postCashDrawerTrx,
} from '@features/cash-drawers/api/cash-drawer-api'
import { USER_SELECTABLE_TRX_TYPES } from '@lib/constants/cash-drawer'
import { useCSRFToken } from '@lib/hooks/use-csrf-token'
import { cmxMessage } from '@ui/feedback'
import { CmxButton, CmxInput, CmxSelect, CmxTextarea, Label } from '@ui/primitives'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'

type Side = 'SOURCE' | 'DESTINATION'

interface CashDrawerTransactionDialogProps {
  drawerId: string
  drawerType: string
  drawerName: string
  branchId: string | null
  currencyCode: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onPosted: () => void
}

/**
 * Custody transaction dialog (CLF-8-6) — float issue, cash drop,
 * drawer-to-drawer, driver handover, deposit preparation. Only
 * user-selectable types are offered (close disposition / reversal are
 * system-posted). The type's catalog rules decide which side(s) this drawer
 * may take and which drawers qualify as the counter-party (same branch,
 * active, same currency, allowed drawer type) — so an invalid pairing can't
 * be chosen rather than being rejected after the fact.
 * @param props component props
 * @param props.drawerId the drawer the dialog was opened from
 * @param props.drawerType that drawer's type code
 * @param props.drawerName that drawer's display name
 * @param props.branchId branch both drawers must belong to
 * @param props.currencyCode transaction currency (the drawer's)
 * @param props.open dialog visibility
 * @param props.onOpenChange visibility setter
 * @param props.onPosted called after a successful post
 */
export function CashDrawerTransactionDialog({
  drawerId,
  drawerType,
  drawerName,
  branchId,
  currencyCode,
  open,
  onOpenChange,
  onPosted,
}: CashDrawerTransactionDialogProps) {
  const t = useTranslations('billing.cashDrawers.trxDialog')
  const tCommon = useTranslations('common')
  const tLedger = useTranslations('cashControl.ledgerErrors')
  const locale = useLocale()
  const { token: csrfToken } = useCSRFToken()

  const [trxTypeCode, setTrxTypeCode] = useState('')
  const [side, setSide] = useState<Side>('SOURCE')
  const [otherDrawerId, setOtherDrawerId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Render-time reset (Pattern A) — fresh idempotency key per open; a retry of
  // the same attempt reuses it.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setIdempotencyKey(crypto.randomUUID())
  }

  const catalogsQuery = useQuery({
    queryKey: ['cash-drawers', 'catalogs'],
    enabled: open,
    queryFn: fetchCashDrawerCatalogs,
    staleTime: 5 * 60_000,
  })
  const drawersQuery = useQuery({
    queryKey: ['cash-drawers', 'branch-drawers', branchId],
    enabled: open && Boolean(branchId),
    queryFn: () => fetchCashDrawersWithCurrentSession(branchId),
  })

  const localized = (row: { name: string; name2: string | null }) =>
    locale === 'ar' && row.name2 ? row.name2 : row.name

  const trxTypes = useMemo(
    () =>
      (catalogsQuery.data?.trxTypes ?? [])
        .filter((tt) => (USER_SELECTABLE_TRX_TYPES as readonly string[]).includes(tt.code))
        .filter((tt) => tt.allowedSrcTypes.includes(drawerType) || tt.allowedDestTypes.includes(drawerType))
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [catalogsQuery.data, drawerType],
  )
  const selectedType = trxTypes.find((tt) => tt.code === trxTypeCode)

  const canBeSource = selectedType?.allowedSrcTypes.includes(drawerType) ?? false
  const canBeDestination = selectedType?.allowedDestTypes.includes(drawerType) ?? false
  // If the chosen side isn't valid for the type, fall back to the one that is
  // (derived, not an effect — no state write during render).
  const effectiveSide: Side =
    side === 'SOURCE' ? (canBeSource ? 'SOURCE' : 'DESTINATION') : canBeDestination ? 'DESTINATION' : 'SOURCE'

  const counterpartyTypes = selectedType
    ? effectiveSide === 'SOURCE'
      ? selectedType.allowedDestTypes
      : selectedType.allowedSrcTypes
    : []
  const counterpartyOptions = (drawersQuery.data ?? [])
    .filter((d) => d.id !== drawerId && d.is_active && d.currency_code === currencyCode)
    .filter((d) => counterpartyTypes.includes(d.drawer_type))
  const counterpartyValid = counterpartyOptions.some((d) => d.id === otherDrawerId)

  const reset = () => {
    setTrxTypeCode('')
    setSide('SOURCE')
    setOtherDrawerId('')
    setAmount('')
    setNotes('')
  }

  const handleSubmit = async () => {
    if (!branchId || !selectedType) return
    const numeric = Number(amount)
    if (!(numeric > 0)) {
      cmxMessage.error(t('amountMustBePositive'))
      return
    }
    if (!counterpartyValid) {
      cmxMessage.error(t('counterpartyRequired'))
      return
    }
    if (selectedType.requiresNotes && !notes.trim()) {
      cmxMessage.error(t('notesRequired'))
      return
    }

    const sourceId = effectiveSide === 'SOURCE' ? drawerId : otherDrawerId
    const destId = effectiveSide === 'SOURCE' ? otherDrawerId : drawerId
    setSubmitting(true)
    try {
      const result = await postCashDrawerTrx({
        trxTypeCode: selectedType.code,
        branchId,
        lines: [
          { drawerId: sourceId, direction: 'OUT', amount: numeric, currencyCode },
          { drawerId: destId, direction: 'IN', amount: numeric, currencyCode },
        ],
        notes: notes.trim() || undefined,
        idempotencyKey,
        csrfToken,
      })
      cmxMessage.success(t('posted', { trxNo: result.trxNo }))
      reset()
      onOpenChange(false)
      onPosted()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const key = message as Parameters<typeof tLedger>[0]
      cmxMessage.error(message && tLedger.has(key) ? tLedger(key) : message || t('postFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const muted = 'text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]'

  return (
    <CmxDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-4">
          <p className={muted}>{t('description', { drawer: drawerName })}</p>

          {catalogsQuery.isLoading ? (
            <p className={muted}>{tCommon('loading')}</p>
          ) : (
            <CmxSelect
              label={t('type')}
              value={trxTypeCode}
              onChange={(event) => {
                setTrxTypeCode(event.target.value)
                setOtherDrawerId('')
              }}
              options={[
                { value: '', label: t('typePlaceholder') },
                ...trxTypes.map((tt) => ({ value: tt.code, label: localized(tt) })),
              ]}
            />
          )}

          {selectedType && canBeSource && canBeDestination ? (
            <CmxSelect
              label={t('thisDrawerIs')}
              value={effectiveSide}
              onChange={(event) => {
                setSide(event.target.value as Side)
                setOtherDrawerId('')
              }}
              options={[
                { value: 'SOURCE', label: t('sideSource') },
                { value: 'DESTINATION', label: t('sideDestination') },
              ]}
            />
          ) : null}

          {selectedType ? (
            counterpartyOptions.length === 0 && !drawersQuery.isLoading ? (
              <p role="alert" className="text-sm text-destructive">
                {t('noCounterparty')}
              </p>
            ) : (
              <CmxSelect
                label={effectiveSide === 'SOURCE' ? t('toDrawer') : t('fromDrawer')}
                value={otherDrawerId}
                onChange={(event) => setOtherDrawerId(event.target.value)}
                options={[
                  { value: '', label: t('drawerPlaceholder') },
                  ...counterpartyOptions.map((d) => ({
                    value: d.id,
                    label: `${locale === 'ar' && d.drawer_name2 ? d.drawer_name2 : d.drawer_name} (${d.drawer_code})`,
                  })),
                ]}
              />
            )
          ) : null}

          {selectedType ? (
            <>
              <CmxInput
                label={`${t('amount')} (${currencyCode})`}
                type="number"
                min="0.001"
                step="0.001"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <div className="space-y-2">
                <Label>{selectedType.requiresNotes ? t('notes') : t('notesOptional')}</Label>
                <CmxTextarea value={notes} onChange={(event) => setNotes(event.target.value)} />
              </div>
            </>
          ) : null}
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton loading={submitting} disabled={!selectedType} onClick={handleSubmit}>
            {t('submit')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}
