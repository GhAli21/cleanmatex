'use client';

/**
 * Void an order charge (moved out of the retired `orders-financial-tab-rprt`,
 * Reusable View P6-02): the active charges with a Void button each, for users
 * with `orders:manual_charge`. The figures themselves live in the Order
 * Financial View beside it; this panel only offers the action.
 */
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { OrderChargeRow } from '@/app/actions/orders/get-order-financial';
import { useHasPermission } from '@/lib/hooks/usePermissions';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxMoneyText } from '@ui/data-display';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives/cmx-button';
import { VoidOrderChargeDialog } from '../void-order-charge-dialog';

export interface OrderChargesVoidPanelProps {
  orderId: string;
  charges: OrderChargeRow[];
  /** The order's currency and its decimals (BF-18). */
  currencyCode: string | null;
  decimalPlaces: number | null;
}

/**
 * @param props - order id, its charge rows and currency
 * @param props.orderId - order id
 * @param props.charges - the order's charge rows (voided rows are skipped)
 * @param props.currencyCode - order currency
 * @param props.decimalPlaces - order currency decimals
 */
export function OrderChargesVoidPanel({ orderId, charges, currencyCode, decimalPlaces }: OrderChargesVoidPanelProps) {
  const t = useTranslations('orders.detailFull.financialTab');
  const isRTL = useRTL();
  const canVoid = useHasPermission('orders', 'manual_charge');
  const [target, setTarget] = useState<{ id: string; label: string } | null>(null);
  const active = charges.filter((c) => !c.is_voided);
  if (!canVoid || active.length === 0) return null;

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle className="text-base">{t('sections.charges')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent>
        <ul className="flex flex-col divide-y divide-[rgb(var(--cmx-border-rgb))]">
          {active.map((c) => (
            <li key={c.id} className="flex min-h-11 items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1">{c.label ?? c.charge_type}</span>
              <CmxMoneyText amount={c.amount} currencyCode={c.currency_code ?? currencyCode} decimalPlaces={decimalPlaces} locale={isRTL ? 'ar' : 'en'} />
              <CmxButton size="sm" variant="outline" onClick={() => setTarget({ id: c.id, label: c.label ?? c.charge_type })}>
                {t('actions.voidCharge')}
              </CmxButton>
            </li>
          ))}
        </ul>
      </CmxCardContent>
      {target && (
        <VoidOrderChargeDialog
          open
          onOpenChange={(open) => { if (!open) setTarget(null); }}
          orderId={orderId}
          chargeId={target.id}
          chargeLabel={target.label}
        />
      )}
    </CmxCard>
  );
}
