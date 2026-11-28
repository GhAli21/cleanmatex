/**
 * Unit conversions with open multiply / divide rates (like FX). Without `productId`: the
 * Organization-wide pairs (Units & Conversions page). With it: one product's own pairs
 * (product page), which may join different measures or a pack, such as 1 box = 12 pieces.
 */
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { CmxButton, CmxInput, CmxSwitch, Label } from '@ui/primitives';
import { CmxUomSelect } from '@ui/forms';
import { CmxDataTable, CmxEmptyState, type CmxDataTableSimpleColumn } from '@ui/data-display';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { CmxConfirmDialog, CmxStatusBadge, CmxSummaryMessage, useMessage } from '@ui/feedback';
import { typedQtyText } from '@/lib/uom/scale';
import { RATE_DECIMALS } from '@/lib/constants/uom';
import type { UomConversion } from '@/lib/types/uom';
import { uomApi } from '../api/uom-api';
import { useUomUnits } from '../hooks/use-uom-units';
import { uomConversionsKey } from '../hooks/use-uom-conversions';
import { checkRates, conversionUnits, previewRate, suggestedDivideRate } from '../model/conversion-draft';
import { uomErrorText } from './uom-error-text';

type Draft = { id: string | null; fromCode: string; toCode: string; multiplyRate: string; divideRate: string; notes: string; isActive: boolean; divideTouched: boolean };
const EMPTY: Draft = { id: null, fromCode: '', toCode: '', multiplyRate: '', divideRate: '', notes: '', isActive: true, divideTouched: false };

/**
 * @param props - panel props
 * @param props.canManage - whether the user may add, edit, delete or reset conversions
 * @param props.productId - show and edit one product's conversions
 */
export function UomConversionsPanel({ canManage, productId }: { canManage: boolean; productId?: string }) {
  const t = useTranslations('uom');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const { showSuccess, showError } = useMessage();
  const units = useUomUnits(true);
  const key = uomConversionsKey(productId);
  const convs = useQuery({ queryKey: key, queryFn: () => uomApi.listConversions(productId) });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [resetConv, setResetConv] = useState<UomConversion | null>(null);
  const [deleteConv, setDeleteConv] = useState<UomConversion | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, okKey: string, done?: () => void) => {
    setBusy(true);
    try { await fn(); showSuccess(t(okKey)); void qc.invalidateQueries({ queryKey: key }); done?.(); } catch (e) { showError(uomErrorText(e, t)); } finally { setBusy(false); }
  };
  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const rateText = (v: string) => typedQtyText(v, RATE_DECIMALS);
  // The divide rate follows 1 / multiply until the user types their own (shown, never hidden).
  const onMultiply = (v: string) => setDraft((d) => {
    if (!d) return d;
    const multiplyRate = rateText(v);
    return { ...d, multiplyRate, divideRate: d.divideTouched ? d.divideRate : suggestedDivideRate(multiplyRate) ?? d.divideRate };
  });
  const openEdit = (c: UomConversion) => setDraft({ id: c.id, fromCode: c.fromCode, toCode: c.toCode, multiplyRate: c.multiplyRate, divideRate: c.divideRate, notes: c.notes ?? '', isActive: c.isActive, divideTouched: true });
  const rates = draft ? checkRates(draft.multiplyRate, draft.divideRate) : null;
  const ready = !!draft && !!draft.fromCode && !!draft.toCode && draft.fromCode !== draft.toCode && rates === 'ok';
  const preview = draft && ready ? previewRate(draft.multiplyRate) : null;
  const choices = conversionUnits(units.data ?? [], draft?.fromCode ?? '', !!productId);

  const save = () => {
    if (!draft) return;
    const body = { multiplyRate: draft.multiplyRate, divideRate: draft.divideRate, notes: draft.notes || null, isActive: draft.isActive };
    void run(
      () => (draft.id
        ? uomApi.updateConversion(draft.id, body)
        : uomApi.createConversion({ productId: productId ?? null, fromCode: draft.fromCode, toCode: draft.toCode, ...body })),
      draft.id ? 'conversions.updated' : 'conversions.created',
      () => setDraft(null),
    );
  };

  const columns: CmxDataTableSimpleColumn<UomConversion>[] = [
    { key: 'from', header: t('conversions.from'), sortable: false, render: (c) => <bdi className="font-mono">{c.fromCode}</bdi> },
    { key: 'to', header: t('conversions.to'), sortable: false, render: (c) => <bdi className="font-mono">{c.toCode}</bdi> },
    { key: 'multiply', header: t('conversions.multiply'), sortable: false, align: 'end', render: (c) => <bdi dir="ltr" className="font-mono tabular-nums">{c.multiplyRate}</bdi> },
    { key: 'divide', header: t('conversions.divide'), sortable: false, align: 'end', render: (c) => <bdi dir="ltr" className="font-mono tabular-nums">{c.divideRate}</bdi> },
    {
      key: 'status', header: t('units.colStatus'), sortable: false,
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          <CmxStatusBadge size="sm" tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? tCommon('active') : tCommon('inactive')}</CmxStatusBadge>
          {c.isFromSystem && <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{t(c.isCustomized ? 'origin.CUSTOMIZED' : 'origin.SYSTEM')}</CmxStatusBadge>}
        </div>
      ),
    },
    ...(canManage ? [{
      key: 'actions', header: tCommon('actions'), align: 'end' as const,
      render: (c: UomConversion) => {
        const pair = `${c.fromCode} → ${c.toCode}`;
        return (
          <div className="flex items-center justify-end gap-1">
            <CmxSwitch checked={c.isActive} disabled={busy} aria-label={t('conversions.toggleActiveFor', { from: c.fromCode, to: c.toCode })}
              onCheckedChange={(v) => void run(() => uomApi.updateConversion(c.id, { multiplyRate: c.multiplyRate, divideRate: c.divideRate, isActive: v, notes: c.notes }), 'conversions.updated')} />
            <CmxButton variant="ghost" size="sm" aria-label={`${tCommon('edit')} ${pair}`} onClick={() => openEdit(c)}><Pencil className="h-4 w-4" aria-hidden /></CmxButton>
            {c.isFromSystem && c.isCustomized && (
              <CmxButton variant="ghost" size="sm" aria-label={`${t('units.resetToSystem')} ${pair}`} disabled={busy} onClick={() => setResetConv(c)}>
                <RotateCcw className="h-4 w-4" aria-hidden />
              </CmxButton>
            )}
            {!c.isFromSystem && (
              <CmxButton variant="ghost" size="sm" aria-label={`${t('conversions.delete')} ${pair}`} disabled={busy} onClick={() => setDeleteConv(c)}>
                <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
              </CmxButton>
            )}
          </div>
        );
      },
    }] : []),
  ];

  const addButton = (
    <CmxButton type="button" onClick={() => setDraft(EMPTY)}><Plus className="h-4 w-4 me-2" aria-hidden />{t('conversions.add')}</CmxButton>
  );

  return (
    <div className="space-y-4">
      {canManage && <div className="flex justify-end">{addButton}</div>}
      {convs.isError ? (
        <CmxSummaryMessage type="error" message={uomErrorText(convs.error, t)}>
          <div className="mt-2">
            <CmxButton type="button" size="sm" variant="outline" onClick={() => void convs.refetch()}>{tCommon('retry')}</CmxButton>
          </div>
        </CmxSummaryMessage>
      ) : !convs.isLoading && (convs.data ?? []).length === 0 ? (
        <CmxEmptyState
          title={t(productId ? 'conversions.productEmptyTitle' : 'conversions.emptyTitle')}
          description={t(productId ? 'conversions.productEmptyDescription' : 'conversions.emptyDescription')}
          action={canManage ? addButton : undefined}
        />
      ) : (
        <CmxDataTable columns={columns} data={convs.data ?? []} loading={convs.isLoading} paginationFooter="never" auditConfig={false} />
      )}

      <CmxDialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <CmxDialogContent className="max-w-xl w-full mx-4">
          <CmxDialogHeader><CmxDialogTitle>{draft?.id ? t('conversions.editTitle') : t('conversions.createTitle')}</CmxDialogTitle></CmxDialogHeader>
          {draft && (
            <div className="grid gap-4 sm:grid-cols-2">
              <CmxUomSelect
                label={t('conversions.from')}
                required
                placeholder={t('conversions.pickUnit')}
                units={choices.from}
                value={draft.fromCode}
                disabled={!!draft.id}
                // A new "from" unit may not allow the chosen "to" unit any more.
                onChange={(code) => patch({ fromCode: code, toCode: conversionUnits(units.data ?? [], code, !!productId).to.some((u) => u.code === draft.toCode) ? draft.toCode : '' })}
              />
              <CmxUomSelect
                label={t('conversions.to')}
                required
                placeholder={t('conversions.pickUnit')}
                units={choices.to}
                value={draft.toCode}
                disabled={!!draft.id}
                onChange={(code) => patch({ toCode: code })}
              />
              <CmxInput
                label={t('conversions.multiply')}
                required
                dir="ltr"
                className="tabular-nums"
                inputMode="decimal"
                value={draft.multiplyRate}
                helpText={t('conversions.multiplyHelp')}
                error={draft.multiplyRate && rates === 'invalid' ? t('conversions.rateInvalid') : undefined}
                onChange={(e) => onMultiply(e.target.value)}
              />
              <CmxInput
                label={t('conversions.divide')}
                required
                dir="ltr"
                className="tabular-nums"
                inputMode="decimal"
                value={draft.divideRate}
                helpText={t('conversions.divideHelp')}
                error={rates === 'mismatch' ? t('conversions.notReciprocal') : undefined}
                onChange={(e) => patch({ divideRate: rateText(e.target.value), divideTouched: true })}
              />
              {preview && (
                <p className="sm:col-span-2 rounded-[var(--cmx-radius-md)] border border-border bg-surface-muted px-3 py-2 text-sm tabular-nums" role="status" aria-live="polite">
                  <bdi dir="ltr">{t('conversions.preview', { from: draft.fromCode, rate: preview, to: draft.toCode })}</bdi>
                </p>
              )}
              <div className="sm:col-span-2">
                <CmxInput label={t('conversions.notes')} value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <CmxSwitch id="uom-conversion-active" checked={draft.isActive} onCheckedChange={(v) => patch({ isActive: v })} />
                <Label htmlFor="uom-conversion-active">{t('conversions.active')}</Label>
              </div>
            </div>
          )}
          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={() => setDraft(null)}>{tCommon('cancel')}</CmxButton>
            <CmxButton type="button" loading={busy} disabled={!ready} onClick={save}>{tCommon('save')}</CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxConfirmDialog
        open={!!resetConv}
        title={resetConv ? t('conversions.resetConfirmTitle', { from: resetConv.fromCode, to: resetConv.toCode }) : ''}
        description={t('conversions.resetConfirmDescription')}
        confirmLabel={tCommon('reset')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setResetConv(null)}
        onConfirm={async () => {
          if (!resetConv) return;
          await run(() => uomApi.resetConversion(resetConv.id), 'conversions.reset', () => setResetConv(null));
        }}
      />
      <CmxConfirmDialog
        open={!!deleteConv}
        title={deleteConv ? t('conversions.deleteConfirmTitle', { from: deleteConv.fromCode, to: deleteConv.toCode }) : ''}
        description={t('conversions.deleteConfirmDescription')}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setDeleteConv(null)}
        onConfirm={async () => {
          if (!deleteConv) return;
          await run(() => uomApi.deleteConversion(deleteConv.id), 'conversions.deleted', () => setDeleteConv(null));
        }}
      />
    </div>
  );
}
