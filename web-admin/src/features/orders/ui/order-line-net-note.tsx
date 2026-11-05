'use client';

import { useTranslations } from 'next-intl';

/**
 * Says what a line costs after its discounts, under its gross amount. Shows nothing
 * for a line with no discount, or an older line with no stored net.
 * @param props - the line's gross and net, and how to format money
 * @returns the note, or nothing
 */
export function OrderLineNetNote({ gross, net, format }: {
  gross: number | string | null | undefined;
  net: number | string | null | undefined;
  format: (amount: number) => string;
}) {
  const t = useTranslations('orders.itemsList');
  if (net == null || gross == null || Number(net) >= Number(gross)) return null;
  return <div className="text-xs text-gray-500">{t('afterDiscount', { amount: format(Number(net)) })}</div>;
}
