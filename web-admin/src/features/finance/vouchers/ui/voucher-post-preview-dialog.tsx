'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/primitives/table';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { postBizVoucherAction } from '@/app/actions/finance/voucher-actions';
import { PosSessionRequiredAction } from '@features/pos-sessions/ui/pos-session-required-action';
import { readPosSessionRequired, type PosSessionRequiredInfo } from '@features/pos-sessions/model/pos-session-required';
import { LINE_ROLE } from '@/lib/constants/voucher';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import type { VoucherLineData } from '@/lib/types/voucher';

interface VoucherPostPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  voucherId: string;
  lines: VoucherLineData[];
}

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onClose
 * @param root0.onSuccess
 * @param root0.voucherId
 * @param root0.lines
 */
export function VoucherPostPreviewDialog({
  open,
  onClose,
  onSuccess,
  voucherId,
  lines,
}: VoucherPostPreviewDialogProps) {
  const t = useTranslations('finance.vouchers.postPreview');
  const tCommon = useTranslations('common');
  const tLedger = useTranslations('cashControl.ledgerErrors');
  const { formatNumber } = useTenantCurrency();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posSessionRequired, setPosSessionRequired] = useState<PosSessionRequiredInfo | null>(null);

  const deriveExpectedEffect = (line: VoucherLineData): string => {
    if (line.line_role === LINE_ROLE.ORDER_PAYMENT) {
      const isCash = line.payment_method_code?.toUpperCase() === PAYMENT_METHODS.CASH;
      const isCard = line.payment_method_code?.toUpperCase() === PAYMENT_METHODS.CARD;
      if (isCash && line.cash_drawer_session_id) return t('effectPaymentAndCash');
      if (isCash || isCard) return t('effectPaymentCompleted');
      return t('effectPaymentPending');
    }
    if (line.line_role === LINE_ROLE.ORDER_CREDIT_APPLICATION) {
      return t('effectCreditApplication', { type: line.credit_application_type ?? '—' });
    }
    return t('effectNoWiring');
  };

  const draftLines = lines.filter((l) => l.line_status === 'DRAFT');

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    setPosSessionRequired(null);
    try {
      const result = await postBizVoucherAction(voucherId);
      if (!result.success) {
        // A POS-session refusal gets translated text and an inline "Open POS session" action.
        const required = readPosSessionRequired({ code: result.errorCode, details: result.errorDetails });
        setPosSessionRequired(required);
        setError(
          result.errorCode && tLedger.has(result.errorCode as Parameters<typeof tLedger>[0])
            ? tLedger(result.errorCode as Parameters<typeof tLedger>[0])
            : (result.error ?? t('postError'))
        );
        return;
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('postError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <CmxDialog open={open} onOpenChange={onClose}>
      <CmxDialogContent className="max-w-2xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="px-4 pb-2">
          <p className="mb-3 text-sm text-muted-foreground">{t('description')}</p>

          {draftLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noDraftLines')}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table className="w-full text-sm">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="px-3 py-2 text-start font-medium">{t('lineNo')}</TableHead>
                    <TableHead className="px-3 py-2 text-start font-medium">{t('lineRole')}</TableHead>
                    <TableHead className="px-3 py-2 text-end font-medium">{t('amountCol')}</TableHead>
                    <TableHead className="px-3 py-2 text-start font-medium">{t('expectedEffect')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {draftLines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="px-3 py-2 tabular-nums">{formatNumber(line.line_no)}</TableCell>
                      <TableCell className="px-3 py-2 font-mono text-xs">{line.line_role}</TableCell>
                      <TableCell className="px-3 py-2 text-end tabular-nums">
                        {formatNumber(Number(line.amount), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-muted-foreground">
                        {deriveExpectedEffect(line)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
          )}
          {posSessionRequired ? (
            <PosSessionRequiredAction
              info={posSessionRequired}
              idempotencyKey={`voucher_post_${voucherId}`}
              sourceChannel="manual_voucher"
              className="mt-2"
              onOpened={() => {
                setPosSessionRequired(null);
                setError(null);
              }}
            />
          ) : null}
        </div>

        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={onClose} disabled={loading}>
            {t('cancel')}
          </CmxButton>
          <CmxButton
            onClick={handleConfirm}
            disabled={draftLines.length === 0 || loading}
          >
            {loading ? tCommon('loading') : t('confirm')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
