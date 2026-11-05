'use client';

/**
 * Order Financial View header (P5-03, DESIGN §2.4): the hero metric with its
 * status word (never color alone), at most three metrics beside it (D31), and
 * translated badges: payment status, settlement type (BF-17), reconciliation
 * worded "Reconciled / Figures differ / Recalculating" (D32), and for the edit
 * source the outcome chip mapped from the exact service code.
 */
import { useTranslations } from 'next-intl';

import type { OrderFinHeaderMetric, OrderFinancialView, ResolvedOrderFinDisplayConfig } from '@/lib/types/order-fin-view';
import { cn } from '@/lib/utils';
import { CmxStatusBadge, type StatusBadgeVariant } from '@ui/feedback';
import { useFinMoney } from './order-fin-money';
import { paymentStatusLabel, settlementTypeLabel, type Translator } from './order-fin-labels';

/** Snapshot statuses whose figures are final enough to call "reconciled". */
const HEALTHY = new Set(['CURRENT', 'LOCKED']);

/** Header badge for the snapshot and its warnings (D32). */
export function reconciliationState(view: OrderFinancialView): 'reconciled' | 'differs' | 'recalculating' | null {
  if (!view.snapshotStatus) return null;
  if (!HEALTHY.has(view.snapshotStatus)) return 'recalculating';
  return view.warnings.some((w) => w.severity !== 'info') ? 'differs' : 'reconciled';
}

const STATE_TONE = { due: 'warning', dueAtCollection: 'warning', dueOnInvoice: 'warning', settled: 'success', overpaid: 'info' } as const;
const OUTCOME_TONE: Record<string, StatusBadgeVariant> = { SETTLED: 'success', OUTSTANDING: 'warning', OVERPAYMENT: 'info', DENIED: 'error' };
const RECON_TONE = { reconciled: 'success', differs: 'warning', recalculating: 'processing' } as const;

export interface OrderFinHeaderProps {
  view: OrderFinancialView;
  header: ResolvedOrderFinDisplayConfig['header'];
  density?: 'comfortable' | 'compact';
}

/**
 * @param props - the view and the resolved header config
 */
export function OrderFinHeader({ view, header, density = 'comfortable' }: OrderFinHeaderProps) {
  const t = useTranslations() as unknown as Translator;
  const money = useFinMoney(view);
  const { metrics, balanceState } = view.header;
  const hero: OrderFinHeaderMetric = header.emphasize ?? 'balance';
  const others = header.metrics
    .filter((m) => m !== hero && metrics[m] !== undefined)
    .filter((m) => !header.hideZeroMetrics || m === 'total' || m === 'balance' || (metrics[m] ?? 0) !== 0)
    .slice(0, 3);
  const heroWord = hero === 'balance' && balanceState ? t(`orders.finView.balanceStates.${balanceState}`) : null;
  const heroTone = balanceState ? STATE_TONE[balanceState] : 'default';
  const recon = header.showReconciliationBadge ? reconciliationState(view) : null;
  const paymentStatus = header.showPaymentStatus ? paymentStatusLabel(view.header.paymentStatus, t) : null;
  const settlement = header.showSettlementType ? settlementTypeLabel(view.header.settlementType, t) : null;
  const outcome = view.header.editOutcome;
  const delta = metrics.totalDelta;

  if (header.layout === 'badge') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--cmx-border-rgb))] px-3 py-1 text-sm">
        <span className="text-[rgb(var(--cmx-muted-foreground-rgb))]">{t(`orders.finView.metrics.${hero}`)}</span>
        {money(metrics[hero], { tone: heroTone === 'default' ? 'default' : heroTone })}
        {heroWord && <span className="font-medium">{heroWord}</span>}
        {delta != null && delta !== 0 && money(Math.abs(delta), { sign: delta < 0 ? 'minus' : 'plus', size: 'sm', tone: 'muted' })}
      </span>
    );
  }

  return (
    <header className={cn('flex flex-col gap-3', density === 'compact' && 'gap-2')}>
      {(paymentStatus || settlement || recon || outcome) && (
        <div className="flex flex-wrap items-center gap-2">
          {view.orderNo && <span className="text-sm font-medium">#{view.orderNo}</span>}
          {paymentStatus && <CmxStatusBadge size="sm" variant="outline" label={paymentStatus} />}
          {settlement && <CmxStatusBadge size="sm" variant="outline" label={settlement} />}
          {recon && <CmxStatusBadge size="sm" variant={RECON_TONE[recon]} label={t(`orders.finView.reconciliation.${recon}`)} />}
          {outcome && <CmxStatusBadge size="sm" variant={OUTCOME_TONE[outcome] ?? 'default'} label={t(`orders.finView.edit.outcomes.${outcome}`)} />}
        </div>
      )}
      <div className={cn('flex flex-wrap items-end gap-x-6 gap-y-2', header.layout === 'inline' && 'items-center')}>
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb))]">
            {t(`orders.finView.metrics.${hero}`)}
          </span>
          <span className="flex flex-wrap items-baseline gap-2">
            {money(metrics[hero], { size: density === 'compact' || header.layout === 'compact' ? 'lg' : 'xl', tone: heroTone === 'default' ? 'default' : heroTone })}
            {heroWord && <span className="text-sm font-medium">{heroWord}</span>}
          </span>
        </div>
        {others.length > 0 && (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {others.map((m) => (
              <div key={m} className="flex items-baseline gap-1">
                <dt className="text-[rgb(var(--cmx-muted-foreground-rgb))]">{t(`orders.finView.metrics.${m}`)}</dt>
                <dd>{m === 'totalDelta' && metrics[m] != null
                  ? money(Math.abs(metrics[m] as number), { sign: (metrics[m] as number) < 0 ? 'minus' : (metrics[m] as number) > 0 ? 'plus' : 'neutral' })
                  : money(metrics[m])}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );
}
