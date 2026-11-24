/** Conversions tab: organization-wide unit pairs with open multiply/divide rates (like FX). */
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, RotateCcw } from 'lucide-react';
import { CmxButton, CmxInput, CmxSkeletonTable, CmxSwitch } from '@ui/primitives';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/primitives/table';
import { CmxUomSelect } from '@ui/forms';
import { CmxEmptyState } from '@ui/data-display';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { CmxConfirmDialog, CmxStatusBadge, CmxSummaryMessage, useMessage } from '@ui/feedback';
import { reciprocalRate } from '@/lib/uom';
import type { UomConversion } from '@/lib/types/uom';
import { uomApi } from '../api/uom-api';
import { useUomUnits } from '../hooks/use-uom-units';
import { uomErrorText } from './uom-error-text';

const CONV_KEY = ['uom', 'conversions'] as const;
type Draft = { id: string | null; fromCode: string; toCode: string; multiplyRate: string; divideRate: string; notes: string; divideTouched: boolean };
const EMPTY: Draft = { id: null, fromCode: '', toCode: '', multiplyRate: '', divideRate: '', notes: '', divideTouched: false };

/** A rate typed by the user: positive decimal text, at most 12 decimals. */
const validRate = (v: string) => /^\d+(\.\d{1,12})?$/.test(v) && Number(v) > 0;

/**
 * @param props - panel props
 * @param props.canManage - whether the user may add, edit or reset conversions
 */
export function UomConversionsPanel({ canManage }: { canManage: boolean }) {
  const t = useTranslations('uom');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const { showSuccess, showError } = useMessage();
  const units = useUomUnits(true);
  const convs = useQuery({ queryKey: CONV_KEY, queryFn: () => uomApi.listConversions() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [resetConv, setResetConv] = useState<UomConversion | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, okKey: string, done?: () => void) => {
    setBusy(true);
    try { await fn(); showSuccess(t(okKey)); qc.invalidateQueries({ queryKey: CONV_KEY }); done?.(); } catch (e) { showError(uomErrorText(e, t)); } finally { setBusy(false); }
  };
  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  // The divide rate follows 1 / multiply until the user types their own (shown, never hidden).
  const onMultiply = (v: string) => patch({ multiplyRate: v, ...(draft && !draft.divideTouched && validRate(v) ? { divideRate: reciprocalRate(v).toString() } : {}) });
  const openEdit = (c: UomConversion) => setDraft({ id: c.id, fromCode: c.fromCode, toCode: c.toCode, multiplyRate: c.multiplyRate, divideRate: c.divideRate, notes: c.notes ?? '', divideTouched: true });
  const ready = !!draft && !!draft.fromCode && !!draft.toCode && draft.fromCode !== draft.toCode && validRate(draft.multiplyRate) && validRate(draft.divideRate);

  const save = () => {
    if (!draft) return;
    const rates = { multiplyRate: draft.multiplyRate, divideRate: draft.divideRate, notes: draft.notes || null };
    void run(
      () => (draft.id ? uomApi.updateConversion(draft.id, rates) : uomApi.createConversion({ fromCode: draft.fromCode, toCode: draft.toCode, ...rates })),
      draft.id ? 'conversions.updated' : 'conversions.created',
      () => setDraft(null),
    );
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <CmxButton onClick={() => setDraft(EMPTY)}><Plus className="h-4 w-4 me-2" aria-hidden />{t('conversions.add')}</CmxButton>
        </div>
      )}
      {convs.isLoading ? (
        <CmxSkeletonTable rows={5} columns={canManage ? 6 : 5} />
      ) : convs.isError ? (
        <CmxSummaryMessage type="error" message={uomErrorText(convs.error, t)}>
          <div className="mt-2">
            <CmxButton size="sm" variant="outline" onClick={() => void convs.refetch()}>
              {tCommon('retry')}
            </CmxButton>
          </div>
        </CmxSummaryMessage>
      ) : (convs.data ?? []).length === 0 ? (
        <CmxEmptyState
          title={t('conversions.emptyTitle')}
          description={t('conversions.emptyDescription')}
          action={
            canManage ? (
              <CmxButton onClick={() => setDraft(EMPTY)}>
                <Plus className="h-4 w-4 me-2" aria-hidden />{t('conversions.add')}
              </CmxButton>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t('conversions.from')}</TableHead>
                <TableHead className="text-start">{t('conversions.to')}</TableHead>
                <TableHead className="text-end">{t('conversions.multiply')}</TableHead>
                <TableHead className="text-end">{t('conversions.divide')}</TableHead>
                <TableHead className="text-start">{t('units.colStatus')}</TableHead>
                {canManage && <TableHead className="text-end">{tCommon('actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(convs.data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono"><bdi>{c.fromCode}</bdi></TableCell>
                  <TableCell className="font-mono"><bdi>{c.toCode}</bdi></TableCell>
                  <TableCell className="text-end font-mono tabular-nums" dir="ltr">{c.multiplyRate}</TableCell>
                  <TableCell className="text-end font-mono tabular-nums" dir="ltr">{c.divideRate}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <CmxStatusBadge size="sm" tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? tCommon('active') : tCommon('inactive')}</CmxStatusBadge>
                      {c.isFromSystem && <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{t(c.isCustomized ? 'origin.CUSTOMIZED' : 'origin.SYSTEM')}</CmxStatusBadge>}
                    </div>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-end">
                      <div className="flex justify-end items-center gap-1">
                        <CmxSwitch checked={c.isActive} disabled={busy} aria-label={t('conversions.toggleActiveFor', { from: c.fromCode, to: c.toCode })}
                          onCheckedChange={(v) => run(() => uomApi.updateConversion(c.id, { multiplyRate: c.multiplyRate, divideRate: c.divideRate, isActive: v, notes: c.notes }), 'conversions.updated')} />
                        <CmxButton variant="ghost" size="sm" aria-label={tCommon('edit')} onClick={() => openEdit(c)}><Pencil className="h-4 w-4" aria-hidden /></CmxButton>
                        {c.isFromSystem && c.isCustomized && (
                          <CmxButton variant="ghost" size="sm" aria-label={t('units.resetToSystem')} disabled={busy} onClick={() => setResetConv(c)}>
                            <RotateCcw className="h-4 w-4" aria-hidden />
                          </CmxButton>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
                units={units.data ?? []}
                value={draft.fromCode}
                disabled={!!draft.id}
                onChange={(code) => patch({ fromCode: code })}
              />
              <CmxUomSelect
                label={t('conversions.to')}
                required
                placeholder={t('conversions.pickUnit')}
                units={units.data ?? []}
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
                onChange={(e) => patch({ divideRate: e.target.value, divideTouched: true })}
              />
              <div className="sm:col-span-2">
                <CmxInput label={t('conversions.notes')} value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} />
              </div>
            </div>
          )}
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setDraft(null)}>{tCommon('cancel')}</CmxButton>
            <CmxButton loading={busy} disabled={!ready} onClick={save}>{tCommon('save')}</CmxButton>
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
          await run(() => uomApi.resetConversion(resetConv.id), 'conversions.reset');
        }}
      />
    </div>
  );
}
