'use client';

/**
 * Order Edit live card (PLAN §6.4, D20, D33; P5-11 UI, placed by P6-13):
 * under the Review button, the new total, was → difference, the balance after
 * the change and the outcome chip, from the server quote only. While a quote
 * runs, the last confirmed figures stay dimmed with "Updating…"; a refused
 * quote keeps them and says why. "Details" opens the full statement of the
 * same quote. Never computes, never edits any entered amount (CRITICAL RULE #15).
 */
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { OrderFinancialView as OrderFinancialViewModel } from '@/lib/types/order-fin-view';
import { cn } from '@/lib/utils';
import { CmxStatusBadge } from '@ui/feedback';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { CmxButton, CmxSkeleton } from '@ui/primitives';
import type { OrderEditQuoteState } from '../hooks/use-order-edit-financial-quote';
import { useFinMoney } from './order-fin-money';
import { OrderFinancialView } from './order-financial-view';

const OUTCOME_TONE = { SETTLED: 'success', OUTSTANDING: 'warning', OVERPAYMENT: 'info', DENIED: 'error' } as const;

export interface OrderEditFinancialCardProps {
  orderId: string;
  quote: OrderEditQuoteState;
  className?: string;
}

function CardFigures({ view, pending }: { view: OrderFinancialViewModel; pending: boolean }) {
  const t = useTranslations('orders.finView');
  const money = useFinMoney(view);
  const m = view.header.metrics;
  const delta = m.totalDelta ?? 0;
  const outcome = view.header.editOutcome;
  return (
    // Confirmed figures only are announced; a pending quote is not read out.
    <div className={cn('flex flex-col gap-1 motion-safe:transition-opacity', pending && 'opacity-60')} aria-live={pending ? 'off' : 'polite'}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('edit.newTotal')}</span>
        {money(m.projectedTotal, { size: 'lg' })}
      </div>
      <div className="flex flex-wrap items-baseline justify-end gap-2 text-xs text-[rgb(var(--cmx-muted-foreground-rgb))]">
        <span>{t('metrics.originalTotal')}</span>
        {money(m.originalTotal, { size: 'sm', tone: 'muted' })}
        {delta !== 0 && money(Math.abs(delta), { size: 'sm', sign: delta < 0 ? 'minus' : 'plus' })}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('metrics.projectedBalance')}</span>
        {money(m.projectedBalance)}
      </div>
      {outcome && <CmxStatusBadge className="self-start" size="sm" variant={OUTCOME_TONE[outcome]} label={t(`edit.outcomes.${outcome}`)} />}
    </div>
  );
}

/**
 * @param props - order id and the live quote state from `useOrderEditFinancialQuote`
 */
export function OrderEditFinancialCard({ orderId, quote, className }: OrderEditFinancialCardProps) {
  const t = useTranslations('orders.finView');
  const [details, setDetails] = useState(false);

  return (
    <section aria-label={t('title')} className={cn('flex flex-col gap-2 rounded-lg border border-[rgb(var(--cmx-border-rgb))] p-3', className)}>
      {quote.status === 'saved' ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('edit.noChange')}</span>
          <OrderFinancialView source={{ kind: 'order', orderId }} config={{ preset: 'badge', header: { emphasize: 'total' } }} />
        </div>
      ) : quote.view ? (
        <CardFigures view={quote.view} pending={quote.status === 'pending'} />
      ) : quote.status === 'pending' ? (
        <CmxSkeleton className="h-20 w-full" />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {quote.status === 'pending' && <CmxStatusBadge size="sm" variant="processing" label={t('edit.updating')} />}
        {quote.status === 'error' && quote.error && (
          <>
            <span className="text-xs" role="alert">{quote.error.code === 'QUOTE_REJECTED' ? t('edit.quoteFailed') : t(`errors.${quote.error.code}`)}</span>
            <CmxButton size="xs" variant="outline" onClick={quote.retry}>{t('edit.tryAgain')}</CmxButton>
          </>
        )}
        {quote.view && (
          <CmxButton size="xs" variant="ghost" className="ms-auto" onClick={() => setDetails(true)}>{t('actions.details')}</CmxButton>
        )}
      </div>

      {quote.view && (
        <CmxDialog open={details} onOpenChange={setDetails}>
          <CmxDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <CmxDialogHeader>
              <CmxDialogTitle>{t('title')}</CmxDialogTitle>
            </CmxDialogHeader>
            <OrderFinancialView source={{ kind: 'edit', orderId, quote }} config={{ preset: 'detailed', layout: 'sheet', density: 'compact', columns: 1 }} />
          </CmxDialogContent>
        </CmxDialog>
      )}
    </section>
  );
}
