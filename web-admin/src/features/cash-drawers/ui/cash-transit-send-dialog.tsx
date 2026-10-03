'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import { fetchCashDrawersWithCurrentSession } from '@features/cash-drawers/api/cash-drawer-api'
import { postSendTransit } from '@features/cash-drawers/api/cash-transit-api'
import { useCashDrawerErrorMessage } from '@features/cash-drawers/hooks/use-cash-drawer-error-message'
import { DRAWER_TYPES } from '@lib/constants/cash-drawer'
import { useCSRFToken } from '@lib/hooks/use-csrf-token'
import { cmxMessage } from '@ui/feedback'
import { CmxButton, CmxInput, CmxSelect, CmxTextarea, Label } from '@ui/primitives'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'

/** Drawer types that can send or receive a transfer — mirrors the TRANSIT_SEND / TRANSIT_RECEIVE catalog rows. */
const TRANSFER_DRAWER_TYPES: readonly string[] = [DRAWER_TYPES.COUNTER, DRAWER_TYPES.TEMPORARY, DRAWER_TYPES.SAFE]

/** Same shape the server enforces: a positive decimal with at most 4 fraction digits. */
const AMOUNT_PATTERN = /^\d{1,15}(\.\d{1,4})?$/

/** Pure check used for inline validation (nothing is rewritten — what is typed is what is sent). */
export function isValidTransitAmount(value: string): boolean {
  return AMOUNT_PATTERN.test(value.trim()) && Number(value) > 0
}

/**
 * Send cash in transit (D1-4): pick the drawer the cash leaves and the drawer it is meant for. The
 * destination list only offers drawers the transfer can actually reach (same branch and currency,
 * active, a type that can receive), so an impossible pairing cannot be chosen. The amount is sent
 * exactly as typed and an invalid entry is explained inline, never corrected silently.
 */
export function CashTransitSendDialog({
  open,
  onOpenChange,
  onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent: () => void
}) {
  const t = useTranslations('billing.cashDrawers.transit.send')
  const tCommon = useTranslations('common')
  const errorMessage = useCashDrawerErrorMessage()
  const locale = useLocale()
  const { token: csrfToken } = useCSRFToken()

  const [sourceId, setSourceId] = useState('')
  const [destId, setDestId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Render-time reset (Pattern A): a fresh idempotency key per open; a retry of one attempt reuses it.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setIdempotencyKey(crypto.randomUUID())
  }

  const drawersQuery = useQuery({
    queryKey: ['cash-drawers', 'transit-drawers'],
    enabled: open,
    queryFn: () => fetchCashDrawersWithCurrentSession(),
  })

  const drawerLabel = (d: { drawer_name: string; drawer_name2: string | null; drawer_code: string }) =>
    `${locale === 'ar' && d.drawer_name2 ? d.drawer_name2 : d.drawer_name} (${d.drawer_code})`

  const candidates = (drawersQuery.data ?? []).filter((d) => d.is_active && TRANSFER_DRAWER_TYPES.includes(d.drawer_type))
  const source = candidates.find((d) => d.id === sourceId)
  const destOptions = source
    ? candidates.filter(
        (d) => d.id !== source.id && d.branch_id === source.branch_id && d.currency_code === source.currency_code,
      )
    : []

  const amountEntered = amount.trim().length > 0
  const amountValid = isValidTransitAmount(amount)
  const canSubmit = Boolean(source) && destOptions.some((d) => d.id === destId) && amountValid

  const reset = () => {
    setSourceId('')
    setDestId('')
    setAmount('')
    setNotes('')
  }

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const result = await postSendTransit({
        sourceDrawerId: sourceId,
        destDrawerId: destId,
        amount: amount.trim(),
        notes: notes.trim() || undefined,
        idempotencyKey,
        csrfToken,
      })
      cmxMessage.success(t('sent', { no: result.transitNo }))
      reset()
      onOpenChange(false)
      onSent()
    } catch (error) {
      cmxMessage.error(errorMessage(error, t('failed')))
    } finally {
      setSubmitting(false)
    }
  }

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
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('description')}</p>

          <CmxSelect
            label={t('from')}
            value={sourceId}
            onChange={(event) => {
              setSourceId(event.target.value)
              setDestId('')
            }}
            options={[
              { value: '', label: t('drawerPlaceholder') },
              ...candidates.map((d) => ({ value: d.id, label: drawerLabel(d) })),
            ]}
          />

          {source ? (
            destOptions.length === 0 && !drawersQuery.isLoading ? (
              <p role="alert" className="text-sm text-destructive">
                {t('noDestination')}
              </p>
            ) : (
              <CmxSelect
                label={t('to')}
                value={destId}
                onChange={(event) => setDestId(event.target.value)}
                options={[
                  { value: '', label: t('drawerPlaceholder') },
                  ...destOptions.map((d) => ({ value: d.id, label: drawerLabel(d) })),
                ]}
              />
            )
          ) : null}

          {source ? (
            <>
              <div className="space-y-1">
                <CmxInput
                  label={`${t('amount')} (${source.currency_code})`}
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  aria-invalid={amountEntered && !amountValid}
                />
                {amountEntered && !amountValid ? (
                  <p role="alert" className="text-xs text-destructive">
                    {t('amountInvalid')}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>{t('notesOptional')}</Label>
                <CmxTextarea value={notes} onChange={(event) => setNotes(event.target.value)} />
              </div>
            </>
          ) : null}
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton disabled={!canSubmit} loading={submitting} onClick={submit}>
            {t('submit')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}
