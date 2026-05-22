'use client';

import { useTranslations } from 'next-intl';
import {
  CmxCard,
  CmxCardHeader,
  CmxCardTitle,
  CmxCardContent,
} from '@ui/primitives/cmx-card';
import type { LinkedEffectsResult } from '@/lib/types/voucher-wiring';

interface VoucherLinkedEffectsPanelProps {
  effects: LinkedEffectsResult;
}

function AmountCell({ amount }: { amount: { toString(): string } }) {
  return <span className="tabular-nums">{Number(amount).toFixed(2)}</span>;
}

export function VoucherLinkedEffectsPanel({ effects }: VoucherLinkedEffectsPanelProps) {
  const t = useTranslations('finance.vouchers.linkedEffects');

  const hasAny =
    effects.orderPayments.length > 0 ||
    effects.cashDrawerMovements.length > 0 ||
    effects.creditApplications.length > 0;

  if (!hasAny) {
    return (
      <CmxCard>
        <CmxCardContent className="py-6 text-center text-sm text-muted-foreground">
          {t('noEffects')}
        </CmxCardContent>
      </CmxCard>
    );
  }

  return (
    <div className="space-y-4">
      {effects.orderPayments.length > 0 && (
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle className="text-base">{t('orderPayments')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-start font-medium">{t('effectId')}</th>
                    <th className="py-2 text-start font-medium">{t('orderRef')}</th>
                    <th className="py-2 text-end font-medium">{t('amountLabel')}</th>
                    <th className="py-2 text-start font-medium">{t('methodOrType')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {effects.orderPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{p.id.slice(0, 8)}…</td>
                      <td className="py-2">{p.order_id ? <span className="font-mono text-xs">{(p.order_id as string).slice(0, 8)}…</span> : '—'}</td>
                      <td className="py-2 text-end"><AmountCell amount={p.amount} /></td>
                      <td className="py-2">{p.payment_method_code ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CmxCardContent>
        </CmxCard>
      )}

      {effects.cashDrawerMovements.length > 0 && (
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle className="text-base">{t('cashMovements')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-start font-medium">{t('effectId')}</th>
                    <th className="py-2 text-end font-medium">{t('amountLabel')}</th>
                    <th className="py-2 text-start font-medium">{t('methodOrType')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {effects.cashDrawerMovements.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{m.id.slice(0, 8)}…</td>
                      <td className="py-2 text-end"><AmountCell amount={m.amount} /></td>
                      <td className="py-2">{m.movement_type ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CmxCardContent>
        </CmxCard>
      )}

      {effects.creditApplications.length > 0 && (
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle className="text-base">{t('creditApplications')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-start font-medium">{t('effectId')}</th>
                    <th className="py-2 text-start font-medium">{t('orderRef')}</th>
                    <th className="py-2 text-end font-medium">{t('amountLabel')}</th>
                    <th className="py-2 text-start font-medium">{t('methodOrType')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {effects.creditApplications.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{c.id.slice(0, 8)}…</td>
                      <td className="py-2">{c.order_id ? <span className="font-mono text-xs">{(c.order_id as string).slice(0, 8)}…</span> : '—'}</td>
                      <td className="py-2 text-end"><AmountCell amount={c.amount} /></td>
                      <td className="py-2">{c.credit_type ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CmxCardContent>
        </CmxCard>
      )}
    </div>
  );
}
