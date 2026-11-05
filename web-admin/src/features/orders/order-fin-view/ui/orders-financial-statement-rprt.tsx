'use client';

/**
 * Printable order financial statement (P5-07, DESIGN §2.5 `print`): the same
 * Order Financial View in print layout — every visible row open, no toggles or
 * switcher, every line shown, black on white, one column on A4.
 */
import { useTranslations } from 'next-intl';

import type { OrderFinPreset } from '@/lib/types/order-fin-view';
import { OrderFinancialView, type OrderFinSource } from './order-financial-view';

export interface OrdersFinancialStatementRprtProps {
  source: OrderFinSource;
  /** `full` (default) for staff prints, `public` for a customer copy built from the public projection. */
  preset?: Extract<OrderFinPreset, 'detailed' | 'full' | 'audit' | 'public'>;
}

/**
 * @param props - the order source and the print preset
 * @example <OrdersFinancialStatementRprt source={{ kind: 'order', orderId }} />
 */
export function OrdersFinancialStatementRprt({ source, preset = 'full' }: OrdersFinancialStatementRprtProps) {
  const t = useTranslations('orders.finView');
  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white p-6 text-black print:p-0">
      <h1 className="mb-4 text-lg font-semibold">{t('title')}</h1>
      <OrderFinancialView source={source} config={{ preset, layout: 'print', columns: 1, density: 'compact', header: { showReconciliationBadge: false } }} />
    </article>
  );
}
