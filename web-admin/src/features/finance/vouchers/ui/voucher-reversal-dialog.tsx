'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxCheckbox, CmxTextarea } from '@ui/primitives';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxSummaryMessage } from '@ui/feedback';
import { CashPlacementPicker, type CashPlacementChoice } from '@features/cash-drawers/ui/cash-placement-picker';
import { isCashPlacementRecoverable } from '@/lib/constants/cash-drawer';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';
import type { LinkedEffectsResult } from '@/lib/types/voucher-wiring';
import type { VoucherLineData } from '@/lib/types/voucher';

/** What the dialog asks the caller to reverse. */
export interface VoucherReversalRequest {
  reason: string;
  /** Present only for a partial reversal (omitted = every remaining POSTED line). */
  lineIds?: string[];
  /** Present only after the cash gate refused and the user picked a drawer. */
  cashDrawerId?: string;
  cashDrawerSessionId?: string;
}

/** Outcome the caller reports back; `code` is the gate's stable error code when there is one. */
export interface VoucherReversalOutcome {
  ok: boolean;
  code?: string;
}

interface VoucherReversalDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (request: VoucherReversalRequest) => Promise<VoucherReversalOutcome>;
  linkedEffects?: LinkedEffectsResult | null;
  unwindEnabled?: boolean;
  /** The voucher's lines — POSTED, not-yet-reversed ones can be picked for a partial reversal. */
  lines?: VoucherLineData[];
  /** Voucher branch / currency narrow the re-placement drawer list (the gate enforces them again). */
  branchId?: string | null;
  currencyCode?: string | null;
}

/**
 * Reverse confirm dialog: B13 consequence preview, optional line selection for a
 * partial reversal, and — only when the cash-drawer gate refuses to place a cash
 * mirror (deactivated drawer, wrong branch …) — a drawer picker to retry with.
 * @param props component props
 */
export function VoucherReversalDialog({
  open,
  onClose,
  onConfirm,
  linkedEffects = null,
  unwindEnabled = false,
  lines = [],
  branchId = null,
  currencyCode = null,
}: VoucherReversalDialogProps) {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  // Deselected line ids (default = everything selected, so the default path is a full reversal).
  const [deselected, setDeselected] = useState<ReadonlySet<string>>(new Set());
  const [placementRequired, setPlacementRequired] = useState(false);
  const [placement, setPlacement] = useState<CashPlacementChoice | null>(null);

  const reversibleLines = useMemo(
    () => lines.filter((l) => l.line_status === VOUCHER_STATUS.POSTED && !l.reversed_line_id),
    [lines],
  );
  const selectedIds = useMemo(
    () => reversibleLines.filter((l) => !deselected.has(l.id)).map((l) => l.id),
    [reversibleLines, deselected],
  );
  const isPartial = reversibleLines.length > 1 && selectedIds.length < reversibleLines.length;
  const canPickLines = reversibleLines.length > 1;

  const previewItems = useMemo(() => {
    if (!linkedEffects) return [t('reversePreview.unknown')];
    // Effects belong to lines; with a partial selection only the selected lines unwind.
    const inScope = (lineId: string | null) => !isPartial || lineId === null || selectedIds.includes(lineId);
    const payments = linkedEffects.orderPayments.filter((e) => inScope(e.line_id));
    const credits = linkedEffects.creditApplications.filter((e) => inScope(e.line_id));
    const drawer = linkedEffects.cashDrawerMovements.filter((e) => inScope(e.line_id));
    const funding = linkedEffects.fundingTenders.filter((e) => inScope(e.line_id));
    const items: string[] = [];
    if (payments.length > 0) items.push(t('reversePreview.payments', { count: payments.length }));
    if (credits.length > 0) items.push(t('reversePreview.credits', { count: credits.length }));
    if (drawer.length > 0) items.push(t('reversePreview.drawer', { count: drawer.length }));
    if (funding.length > 0) items.push(t('reversePreview.funding', { count: funding.length }));
    if (items.length === 0) items.push(t('reversePreview.none'));
    return items;
  }, [linkedEffects, isPartial, selectedIds, t]);

  const reset = () => {
    setReason('');
    setDeselected(new Set());
    setPlacementRequired(false);
    setPlacement(null);
  };

  const toggleLine = (lineId: string, checked: boolean) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  const canSubmit =
    reason.trim().length > 0 &&
    (!canPickLines || selectedIds.length > 0) &&
    (!placementRequired || placement !== null) &&
    !loading;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const outcome = await onConfirm({
        reason: reason.trim(),
        lineIds: isPartial ? selectedIds : undefined,
        cashDrawerId: placement?.cashDrawerId,
        cashDrawerSessionId: placement?.cashDrawerSessionId ?? undefined,
      });
      if (outcome.ok) {
        reset();
        onClose();
      } else if (isCashPlacementRecoverable(outcome.code)) {
        // The gate could not place a cash mirror — let the user choose where.
        setPlacementRequired(true);
        setPlacement(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <CmxDialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('actions.reverse')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-3 p-4">
          <CmxSummaryMessage
            type={unwindEnabled ? 'warning' : 'info'}
            title={unwindEnabled ? t('reversePreview.unwindTitle') : t('reversePreview.documentOnlyTitle')}
            items={previewItems}
          />

          {canPickLines ? (
            <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-sm font-medium text-foreground">{t('reversal.linesTitle')}</legend>
              <p className="text-xs text-muted-foreground">{t('reversal.linesHint')}</p>
              {reversibleLines.map((line) => (
                <CmxCheckbox
                  key={line.id}
                  checked={!deselected.has(line.id)}
                  onChange={(event) => toggleLine(line.id, event.target.checked)}
                  disabled={loading}
                  label={t('reversal.lineLabel', {
                    lineNo: line.line_no,
                    role: line.line_role,
                    amount: Number(line.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
                    currency: line.currency_code ?? currencyCode ?? '',
                  })}
                />
              ))}
              {selectedIds.length === 0 ? (
                <p role="alert" className="text-xs text-destructive">{t('reversal.noneSelected')}</p>
              ) : null}
            </fieldset>
          ) : null}

          {placementRequired ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-900">{t('reversal.placementExplain')}</p>
              <CashPlacementPicker
                branchId={branchId}
                currencyCode={currencyCode}
                value={placement}
                onChange={setPlacement}
                disabled={loading}
              />
            </div>
          ) : null}

          <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="voucher-reversal-reason">
            {t('reversalReason')}
          </label>
          <CmxTextarea
            id="voucher-reversal-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reasonPlaceholder')}
          />
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={handleClose} disabled={loading}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton variant="destructive" onClick={handleConfirm} disabled={!canSubmit} loading={loading}>
            {isPartial ? t('reversal.confirmPartial', { count: selectedIds.length }) : t('actions.reverse')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
