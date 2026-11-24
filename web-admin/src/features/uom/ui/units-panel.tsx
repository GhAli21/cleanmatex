/** Units tab: the Organization's units, add from the system catalog, custom units, edit, reset. */
'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, RotateCcw } from 'lucide-react';
import { CmxButton, CmxCheckbox, CmxInput, CmxSelect, CmxSkeleton, CmxSkeletonTable, CmxSwitch } from '@ui/primitives';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/primitives/table';
import { CmxEmptyState } from '@ui/data-display';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { CmxConfirmDialog, CmxStatusBadge, CmxSummaryMessage, useMessage } from '@ui/feedback';
import { UOM_DIMENSION_ORDER, UOM_DIMENSIONS, type UomDimension } from '@/lib/constants/uom';
import type { UomUnit } from '@/lib/types/uom';
import { uomApi } from '../api/uom-api';
import { UOM_UNITS_KEY, useUomUnits } from '../hooks/use-uom-units';
import { uomErrorText } from './uom-error-text';

type Draft = { code: string; name: string; name2: string; symbol: string; symbol2: string; dimension: UomDimension; qtyDecimals: number; uneceCode: string };
const EMPTY: Draft = { code: '', name: '', name2: '', symbol: '', symbol2: '', dimension: UOM_DIMENSIONS.MASS, qtyDecimals: 2, uneceCode: '' };

/**
 * @param props - panel props
 * @param props.canManage - whether the user may add, edit or reset units
 */
export function UomUnitsPanel({ canManage }: { canManage: boolean }) {
  const t = useTranslations('uom');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();
  const { showSuccess, showError } = useMessage();
  const units = useUomUnits(false);
  const addable = useQuery({ queryKey: ['uom', 'addable'], queryFn: uomApi.listAddable, enabled: canManage });

  const [edit, setEdit] = useState<{ code: string | null; draft: Draft } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [resetCode, setResetCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => { qc.invalidateQueries({ queryKey: UOM_UNITS_KEY }); qc.invalidateQueries({ queryKey: ['uom', 'addable'] }); };
  const run = async (fn: () => Promise<unknown>, okKey: string, done?: () => void) => {
    setBusy(true);
    try { await fn(); showSuccess(t(okKey)); refresh(); done?.(); } catch (e) { showError(uomErrorText(e, t)); } finally { setBusy(false); }
  };
  const label = (u: { name: string; name2: string | null }) => (locale === 'ar' && u.name2 ? u.name2 : u.name);
  const sym = (u: UomUnit) => (locale === 'ar' && u.symbol2 ? u.symbol2 : u.symbol);

  const openEdit = (u: UomUnit) => setEdit({ code: u.code, draft: { code: u.code, name: u.name, name2: u.name2 ?? '', symbol: u.symbol, symbol2: u.symbol2 ?? '', dimension: u.dimension, qtyDecimals: u.qtyDecimals, uneceCode: u.uneceCode ?? '' } });
  const save = () => {
    if (!edit) return;
    const d = edit.draft;
    const presentation = { name: d.name, name2: d.name2 || null, symbol: d.symbol, symbol2: d.symbol2 || null, qtyDecimals: d.qtyDecimals };
    void run(
      () => (edit.code ? uomApi.updateUnit(edit.code, presentation) : uomApi.createUnit({ ...presentation, code: d.code, dimension: d.dimension, uneceCode: d.uneceCode || null })),
      edit.code ? 'units.updated' : 'units.created',
      () => setEdit(null),
    );
  };
  const patch = (p: Partial<Draft>) => setEdit((e) => (e ? { ...e, draft: { ...e.draft, ...p } } : e));
  const isCount = edit?.draft.dimension === UOM_DIMENSIONS.COUNT;
  const locked = !!edit?.code; // code and dimension never change after creation

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap gap-2 justify-end">
          <CmxButton variant="outline" onClick={() => { setPicked([]); setAddOpen(true); }}>
            <Plus className="h-4 w-4 me-2" aria-hidden />{t('units.addFromSystem')}
          </CmxButton>
          <CmxButton onClick={() => setEdit({ code: null, draft: EMPTY })}>
            <Plus className="h-4 w-4 me-2" aria-hidden />{t('units.addCustom')}
          </CmxButton>
        </div>
      )}

      {units.isLoading ? (
        <CmxSkeletonTable rows={5} columns={canManage ? 8 : 7} />
      ) : units.isError ? (
        <CmxSummaryMessage type="error" message={uomErrorText(units.error, t)}>
          <div className="mt-2">
            <CmxButton size="sm" variant="outline" onClick={() => void units.refetch()}>
              {tCommon('retry')}
            </CmxButton>
          </div>
        </CmxSummaryMessage>
      ) : (units.data ?? []).length === 0 ? (
        <CmxEmptyState
          title={t('units.emptyTitle')}
          description={t('units.emptyDescription')}
          action={
            canManage ? (
              <CmxButton onClick={() => { setPicked([]); setAddOpen(true); }}>
                <Plus className="h-4 w-4 me-2" aria-hidden />{t('units.addFromSystem')}
              </CmxButton>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t('units.colCode')}</TableHead>
                <TableHead className="text-start">{t('units.colName')}</TableHead>
                <TableHead className="text-start">{t('units.colSymbol')}</TableHead>
                <TableHead className="text-start">{t('units.colDimension')}</TableHead>
                <TableHead className="text-end">{t('units.colDecimals')}</TableHead>
                <TableHead className="text-end">{t('units.colProducts')}</TableHead>
                <TableHead className="text-start">{t('units.colStatus')}</TableHead>
                {canManage && <TableHead className="text-end">{tCommon('actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(units.data ?? []).map((u) => (
                <TableRow key={u.code}>
                  <TableCell className="font-mono"><bdi>{u.code}</bdi></TableCell>
                  <TableCell>{label(u)}</TableCell>
                  <TableCell>{sym(u)}</TableCell>
                  <TableCell>{t(`dimensions.${u.dimension}`)}</TableCell>
                  <TableCell className="text-end tabular-nums">{u.qtyDecimals}</TableCell>
                  <TableCell className="text-end tabular-nums">{u.productCount ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <CmxStatusBadge size="sm" tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? tCommon('active') : tCommon('inactive')}</CmxStatusBadge>
                      <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{t(`origin.${u.origin}`)}</CmxStatusBadge>
                    </div>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-end">
                      <div className="flex justify-end items-center gap-1">
                        <CmxSwitch
                          checked={u.isActive}
                          disabled={busy || u.isBaseUnit}
                          aria-label={t('units.toggleActive', { code: u.code })}
                          onCheckedChange={(v) => run(() => uomApi.updateUnit(u.code, { isActive: v }), 'units.updated')}
                        />
                        <CmxButton variant="ghost" size="sm" aria-label={tCommon('edit')} onClick={() => openEdit(u)}><Pencil className="h-4 w-4" aria-hidden /></CmxButton>
                        {u.origin === 'CUSTOMIZED' && (
                          <CmxButton variant="ghost" size="sm" aria-label={t('units.resetToSystem')} disabled={busy} onClick={() => setResetCode(u.code)}>
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

      <CmxDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <CmxDialogContent className="max-w-2xl w-full mx-4">
          <CmxDialogHeader><CmxDialogTitle>{edit?.code ? t('units.editTitle', { code: edit.code }) : t('units.createTitle')}</CmxDialogTitle></CmxDialogHeader>
          {edit && (
            <div className="grid gap-4 sm:grid-cols-2">
              <CmxInput
                label={t('units.colCode')}
                required
                dir="ltr"
                className="font-mono"
                value={edit.draft.code}
                disabled={locked}
                onChange={(e) => patch({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 20) })}
              />
              <CmxSelect
                label={t('units.colDimension')}
                required
                value={edit.draft.dimension}
                disabled={locked}
                onChange={(e) => patch({ dimension: e.target.value as UomDimension, qtyDecimals: e.target.value === UOM_DIMENSIONS.COUNT ? 0 : edit.draft.qtyDecimals })}
                options={UOM_DIMENSION_ORDER.map((d) => ({ value: d, label: t(`dimensions.${d}`) }))}
              />
              <CmxInput label={t('units.nameEn')} required value={edit.draft.name} onChange={(e) => patch({ name: e.target.value })} />
              <CmxInput label={t('units.nameAr')} dir="rtl" value={edit.draft.name2} onChange={(e) => patch({ name2: e.target.value })} />
              <CmxInput label={t('units.symbolEn')} required value={edit.draft.symbol} onChange={(e) => patch({ symbol: e.target.value })} />
              <CmxInput label={t('units.symbolAr')} dir="rtl" value={edit.draft.symbol2} onChange={(e) => patch({ symbol2: e.target.value })} />
              <CmxInput
                label={t('units.colDecimals')}
                type="number"
                dir="ltr"
                className="tabular-nums"
                min={0}
                max={6}
                value={edit.draft.qtyDecimals}
                disabled={isCount}
                helpText={isCount ? t('units.countWhole') : undefined}
                onChange={(e) => patch({ qtyDecimals: Math.min(6, Math.max(0, Math.trunc(Number(e.target.value) || 0))) })}
              />
              {!edit.code && (
                <CmxInput
                  label={t('units.unece')}
                  dir="ltr"
                  className="font-mono"
                  maxLength={3}
                  value={edit.draft.uneceCode}
                  onChange={(e) => patch({ uneceCode: e.target.value.toUpperCase() })}
                />
              )}
            </div>
          )}
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setEdit(null)}>{tCommon('cancel')}</CmxButton>
            <CmxButton loading={busy} disabled={!edit || !edit.draft.name || !edit.draft.symbol || (!edit.code && !edit.draft.code)} onClick={save}>{tCommon('save')}</CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={addOpen} onOpenChange={setAddOpen}>
        <CmxDialogContent className="max-w-xl w-full mx-4">
          <CmxDialogHeader><CmxDialogTitle>{t('units.addFromSystem')}</CmxDialogTitle></CmxDialogHeader>
          {addable.isLoading ? (
            <div className="space-y-2 py-2">
              <CmxSkeleton className="h-6 w-full" />
              <CmxSkeleton className="h-6 w-full" />
              <CmxSkeleton className="h-6 w-3/4" />
            </div>
          ) : addable.isError ? (
            <CmxSummaryMessage type="error" message={uomErrorText(addable.error, t)}>
              <div className="mt-2">
                <CmxButton size="sm" variant="outline" onClick={() => void addable.refetch()}>
                  {tCommon('retry')}
                </CmxButton>
              </div>
            </CmxSummaryMessage>
          ) : (addable.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">{t('units.nothingToAdd')}</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto space-y-1">
              {addable.data!.map((u) => (
                <li key={u.code}>
                  <CmxCheckbox
                    checked={picked.includes(u.code)}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, u.code] : p.filter((c) => c !== u.code)))}
                    label={<span><bdi className="font-mono">{u.code}</bdi> {label(u)} <span className="text-muted-foreground text-xs">{t(`dimensions.${u.dimension}`)}</span></span>}
                  />
                </li>
              ))}
            </ul>
          )}
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setAddOpen(false)}>{tCommon('cancel')}</CmxButton>
            <CmxButton loading={busy} disabled={picked.length === 0} onClick={() => run(() => uomApi.addSystemUnits(picked), 'units.added', () => setAddOpen(false))}>{t('units.addSelected', { count: picked.length })}</CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxConfirmDialog
        open={!!resetCode}
        title={resetCode ? t('units.resetConfirmTitle', { code: resetCode }) : ''}
        description={t('units.resetConfirmDescription')}
        confirmLabel={tCommon('reset')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setResetCode(null)}
        onConfirm={async () => {
          if (!resetCode) return;
          await run(() => uomApi.resetUnit(resetCode), 'units.reset');
        }}
      />
    </div>
  );
}
