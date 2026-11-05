'use client';

/**
 * One order's balance and its status word, from a batch header (P3-04/P4-02),
 * for list rows (AR invoice linked orders, handover lists). No fetch here:
 * the list reads every row's header in one request (`useOrderFinancialHeaders`).
 */
import { useTranslations } from 'next-intl';

import type { OrderFinHeaderView } from '@/lib/types/order-fin-view';
import { useFinMoney } from './order-fin-money';

const TONE = { due: 'warning', dueAtCollection: 'warning', dueOnInvoice: 'warning', settled: 'success', overpaid: 'info' } as const;

/**
 * @param props - the header view of one order, or undefined while loading / not visible
 * @param props.header - the order's header view
 */
export function OrderFinBalanceBadge({ header }: { header: OrderFinHeaderView | undefined }) {
  const t = useTranslations('orders.finView');
  const money = useFinMoney({ currency: header?.currency ?? { code: null, decimalPlaces: null } });
  if (!header) return <span className="text-[rgb(var(--cmx-muted-foreground-rgb))]">—</span>;
  const state = header.header.balanceState;
  if (!state) return <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('banners.unavailable')}</span>;
  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      {money(header.header.metrics.balance, { tone: TONE[state], size: 'sm' })}
      <span className="text-xs">{t(`balanceStates.${state}`)}</span>
    </span>
  );
}
