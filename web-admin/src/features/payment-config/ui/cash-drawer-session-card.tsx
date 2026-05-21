'use client';

import { useTranslations } from 'next-intl';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import type { OrgCashDrawer, OrgCashDrawerSession } from '@/lib/types/payment';

interface CashDrawerSessionCardProps {
  session: OrgCashDrawerSession;
  drawer: OrgCashDrawer;
  open: boolean;
  onClose: () => void;
}

function CashDrawerSessionRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export function CashDrawerSessionCard({ session, drawer, open, onClose }: CashDrawerSessionCardProps) {
  const t = useTranslations('paymentConfig');

  const formatAmount = (amount: number | null | undefined) =>
    amount != null
      ? `${amount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${session.currency_code}`
      : '—';

  const differenceAmount = session.difference_amount;
  const diffColor =
    differenceAmount == null
      ? ''
      : differenceAmount > 0
      ? 'text-green-600'
      : differenceAmount < 0
      ? 'text-destructive'
      : 'text-muted-foreground';

  return (
    <CmxDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <CmxDialogContent className="max-w-sm">
        <CmxDialogHeader>
          <CmxDialogTitle>{drawer.drawer_name}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="py-2 space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-green-600 text-white">{t('cashDrawers.sessionOpen')}</Badge>
            <span className="text-xs text-muted-foreground">{session.session_no}</span>
          </div>

          <CashDrawerSessionRow
            label={t('cashDrawers.openedAt')}
            value={new Date(session.opened_at).toLocaleString()}
          />
          <CashDrawerSessionRow
            label={t('cashDrawers.openingFloat')}
            value={formatAmount(session.opening_float_amount)}
          />
          <CashDrawerSessionRow
            label={t('cashDrawers.expectedCash')}
            value={formatAmount(session.expected_cash_amount)}
          />
          {session.counted_cash_amount != null && (
            <CashDrawerSessionRow
              label={t('cashDrawers.countedCash')}
              value={formatAmount(session.counted_cash_amount)}
            />
          )}
          {differenceAmount != null && (
            <CashDrawerSessionRow
              label={t('cashDrawers.difference')}
              value={
                <span className={diffColor}>
                  {differenceAmount >= 0 ? '+' : ''}
                  {formatAmount(differenceAmount)}
                </span>
              }
            />
          )}
        </div>

        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={onClose}>{t('common.close')}</CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
