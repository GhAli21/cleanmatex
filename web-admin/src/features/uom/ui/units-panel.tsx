/** Units tab: the Organization's units — search and filter, add from the system catalog, custom units, edit, reset. */
'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, RotateCcw } from 'lucide-react';
import { CmxButton, CmxCheckbox, CmxInput, CmxSelect, CmxSkeleton, CmxSwitch } from '@ui/primitives';
import { CmxDataTable, CmxEmptyState, type CmxDataTableSimpleColumn } from '@ui/data-display';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { CmxConfirmDialog, CmxStatusBadge, CmxSummaryMessage, useMessage } from '@ui/feedback';
import { UOM_DIMENSION_ORDER, UOM_DIMENSIONS, type UomDimension } from '@/lib/constants/uom';
import type { UomUnit } from '@/lib/types/uom';
import { uomApi } from '../api/uom-api';
import { UOM_UNITS_KEY } from '../hooks/use-uom-units';
import { filterUnits, NO_UNIT_FILTER, type UnitFilter } from '../model/unit-filter';
import { uomErrorText } from './uom-error-text';

type Draft = {
  code: string; name: string; name2: string; symbol: string; symbol2: string; dimension: UomDimension;
  qtyDecimals: number; uneceCode: string; baseRate: string; isPackaging: boolean; displayOrder: string;
};
const EMPTY: Draft = {
  code: '', name: '', name2: '', symbol: '', symbol2: '', dimension: UOM_DIMENSIONS.MASS,
  qtyDecimals: 2, uneceCode: '', baseRate: '', isPackaging: false, displayOrder: '',
};

const toDraft = (u: UomUnit): Draft => ({
  code: u.code, name: u.name, name2: u.name2 ?? '', symbol: u.symbol, symbol2: u.symbol2 ?? '', dimension: u.dimension,
  qtyDecimals: u.qtyDecimals, uneceCode: u.uneceCode ?? '', baseRate: '', isPackaging: u.isPackaging,
  displayOrder: u.displayOrder == null ? '' : String(u.displayOrder),
});

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
  // Under the shared units key, so a save also refreshes every unit picker.
  const units = useQuery({ queryKey: [...UOM_UNITS_KEY, 'counts'], queryFn: uomApi.listUnitsWithCounts });
  const addable = useQuery({ queryKey: ['uom', 'addable'], queryFn: uomApi.listAddable, enabled: canManage });

  const [filter, setFilter] = useState<UnitFilter>(NO_UNIT_FILTER);
  const [edit, setEdit] = useState<{ unit: UomUnit | null; draft: Draft } | null>(null);
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
  const sym = (u: Pick<UomUnit, 'symbol' | 'symbol2'>) => (locale === 'ar' && u.symbol2 ? u.symbol2 : u.symbol);

  const all = useMemo(() => units.data ?? [], [units.data]);
  const shown = useMemo(() => filterUnits(all, filter), [all, filter]);
  const filtering = filter.search !== '' || filter.dimension !== '' || filter.status !== '';

  /** A unit with products cannot be switched off: say how many instead of sending a request that fails. */
  const toggle = (u: UomUnit, active: boolean) => {
    if (!active && (u.productCount ?? 0) > 0) { showError(t('units.inUse', { count: u.productCount ?? 0 })); return; }
    void run(() => uomApi.updateUnit(u.code, { isActive: active }), 'units.updated');
  };

  const columns: CmxDataTableSimpleColumn<UomUnit>[] = [
    { key: 'code', header: t('units.colCode'), sortable: false, render: (u) => <bdi className="font-mono">{u.code}</bdi> },
    { key: 'name', header: t('units.colName'), sortable: false, render: (u) => label(u) },
    { key: 'symbol', header: t('units.colSymbol'), sortable: false, render: (u) => sym(u) },
    { key: 'dimension', header: t('units.colDimension'), sortable: false, render: (u) => t(`dimensions.${u.dimension}`) },
    { key: 'decimals', header: t('units.colDecimals'), sortable: false, align: 'end', render: (u) => <span className="tabular-nums">{u.qtyDecimals}</span> },
    { key: 'products', header: t('units.colProducts'), sortable: false, align: 'end', render: (u) => <span className="tabular-nums">{u.productCount ?? 0}</span> },
    {
      key: 'status', header: t('units.colStatus'), sortable: false,
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          <CmxStatusBadge size="sm" tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? tCommon('active') : tCommon('inactive')}</CmxStatusBadge>
          <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{t(`origin.${u.origin}`)}</CmxStatusBadge>
          {u.isPackaging && <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{t('units.packaging')}</CmxStatusBadge>}
        </div>
      ),
    },
    ...(canManage ? [{
      key: 'actions', header: tCommon('actions'), align: 'end' as const,
      render: (u: UomUnit) => (
        <div className="flex items-center justify-end gap-1">
          <span title={u.isBaseUnit ? t('units.baseLocked') : undefined}>
            <CmxSwitch
              checked={u.isActive}
              disabled={busy || u.isBaseUnit}
              aria-label={u.isBaseUnit ? `${t('units.toggleActive', { code: u.code })}. ${t('units.baseLocked')}` : t('units.toggleActive', { code: u.code })}
              onCheckedChange={(active) => toggle(u, active)}
            />
          </span>
          <CmxButton variant="ghost" size="sm" aria-label={`${tCommon('edit')} ${u.code}`} onClick={() => setEdit({ unit: u, draft: toDraft(u) })}>
            <Pencil className="h-4 w-4" aria-hidden />
          </CmxButton>
          {u.origin === 'CUSTOMIZED' && (
            <CmxButton variant="ghost" size="sm" aria-label={`${t('units.resetToSystem')} ${u.code}`} disabled={busy} onClick={() => setResetCode(u.code)}>
              <RotateCcw className="h-4 w-4" aria-hidden />
            </CmxButton>
          )}
        </div>
      ),
    }] : []),
  ];

  const patch = (p: Partial<Draft>) => setEdit((e) => (e ? { ...e, draft: { ...e.draft, ...p } } : e));
  const editing = edit?.unit ?? null;
  const isCount = edit?.draft.dimension === UOM_DIMENSIONS.COUNT;
  // The UN/ECE code and the packaging flag of a system unit belong to HQ.
  const isSystem = !!editing && editing.origin !== 'CUSTOM';
  // A new measured unit must say how big it is, or nothing can convert it.
  const needsBaseRate = !!edit && !editing && !isCount;
  const baseUnit = all.find((u) => u.isBaseUnit && u.dimension === edit?.draft.dimension);
  const baseRateOk = !needsBaseRate || Number(edit?.draft.baseRate) > 0;
  const uneceOk = !edit?.draft.uneceCode || /^[A-Z0-9]{2,3}$/.test(edit.draft.uneceCode);

  const save = () => {
    if (!edit) return;
    const d = edit.draft;
    const presentation = {
      name: d.name, name2: d.name2 || null, symbol: d.symbol, symbol2: d.symbol2 || null, qtyDecimals: d.qtyDecimals,
      displayOrder: d.displayOrder === '' ? null : Number(d.displayOrder),
    };
    void run(
      () => (editing
        ? uomApi.updateUnit(editing.code, { ...presentation, ...(isSystem ? {} : { uneceCode: d.uneceCode || null }) })
        : uomApi.createUnit({
          ...presentation, code: d.code, dimension: d.dimension, uneceCode: d.uneceCode || null,
          isPackaging: isCount && d.isPackaging, baseMultiplyRate: needsBaseRate ? d.baseRate : null,
        })),
      editing ? 'units.updated' : 'units.created',
      () => setEdit(null),
    );
  };

  const addButton = (
    <CmxButton variant="outline" onClick={() => { setPicked([]); setAddOpen(true); }}>
      <Plus className="h-4 w-4 me-2" aria-hidden />{t('units.addFromSystem')}
    </CmxButton>
  );

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap justify-end gap-2">
          {addButton}
          <CmxButton onClick={() => setEdit({ unit: null, draft: EMPTY })}>
            <Plus className="h-4 w-4 me-2" aria-hidden />{t('units.addCustom')}
          </CmxButton>
        </div>
      )}

      {units.isError ? (
        <CmxSummaryMessage type="error" message={uomErrorText(units.error, t)}>
          <div className="mt-2">
            <CmxButton size="sm" variant="outline" onClick={() => void units.refetch()}>{tCommon('retry')}</CmxButton>
          </div>
        </CmxSummaryMessage>
      ) : !units.isLoading && all.length === 0 ? (
        <CmxEmptyState title={t('units.emptyTitle')} description={t('units.emptyDescription')} action={canManage ? addButton : undefined} />
      ) : (
        <>
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <CmxInput
                type="search"
                label={t('units.search')}
                placeholder={t('units.searchPlaceholder')}
                value={filter.search}
                onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <CmxSelect
              label={t('units.filterDimension')}
              value={filter.dimension}
              onChange={(e) => setFilter((f) => ({ ...f, dimension: e.target.value as UnitFilter['dimension'] }))}
              options={[{ value: '', label: t('units.filterAll') }, ...UOM_DIMENSION_ORDER.map((d) => ({ value: d, label: t(`dimensions.${d}`) }))]}
            />
            <CmxSelect
              label={t('units.filterStatus')}
              value={filter.status}
              onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as UnitFilter['status'] }))}
              options={[
                { value: '', label: t('units.filterAll') },
                { value: 'active', label: tCommon('active') },
                { value: 'inactive', label: tCommon('inactive') },
              ]}
            />
          </div>
          {filtering && (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {t('units.shown', { shown: shown.length, total: all.length })}
            </p>
          )}
          {!units.isLoading && shown.length === 0 ? (
            <CmxEmptyState
              title={t('units.noMatchTitle')}
              description={t('units.noMatchDescription')}
              action={<CmxButton variant="outline" onClick={() => setFilter(NO_UNIT_FILTER)}>{t('units.clearFilters')}</CmxButton>}
            />
          ) : (
            <CmxDataTable columns={columns} data={shown} loading={units.isLoading} paginationFooter="never" auditConfig={false} />
          )}
        </>
      )}

      <CmxDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <CmxDialogContent className="max-w-2xl w-full mx-4">
          <CmxDialogHeader><CmxDialogTitle>{editing ? t('units.editTitle', { code: editing.code }) : t('units.createTitle')}</CmxDialogTitle></CmxDialogHeader>
          {edit && (
            <div className="grid gap-4 sm:grid-cols-2">
              <CmxInput
                label={t('units.colCode')}
                required
                dir="ltr"
                className="font-mono"
                value={edit.draft.code}
                disabled={!!editing}
                onChange={(e) => patch({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 20) })}
              />
              <CmxSelect
                label={t('units.colDimension')}
                required
                value={edit.draft.dimension}
                disabled={!!editing}
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
              <CmxInput
                label={t('units.displayOrder')}
                dir="ltr"
                inputMode="numeric"
                className="tabular-nums"
                value={edit.draft.displayOrder}
                helpText={t('units.displayOrderHelp')}
                onChange={(e) => patch({ displayOrder: e.target.value.replace(/[^0-9]/g, '').slice(0, 5) })}
              />
              {needsBaseRate && (
                <CmxInput
                  label={t('units.baseRate', { base: baseUnit ? sym(baseUnit) : '' })}
                  required
                  dir="ltr"
                  inputMode="decimal"
                  className="tabular-nums"
                  value={edit.draft.baseRate}
                  helpText={t('units.baseRateHelp')}
                  onChange={(e) => patch({ baseRate: e.target.value.replace(/[^0-9.]/g, '') })}
                />
              )}
              <CmxInput
                label={t('units.unece')}
                dir="ltr"
                className="font-mono"
                maxLength={3}
                disabled={isSystem}
                value={edit.draft.uneceCode}
                helpText={isSystem ? t('errors.UOM_FIELD_LOCKED') : t('units.uneceHelp')}
                error={uneceOk ? undefined : t('units.uneceHelp')}
                onChange={(e) => patch({ uneceCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
              />
              {/* Fixed once created: flipping it would orphan the unit's conversions. */}
              {!editing && isCount && (
                <div className="sm:col-span-2">
                  <CmxCheckbox
                    checked={edit.draft.isPackaging}
                    onChange={(e) => patch({ isPackaging: e.target.checked })}
                    label={t('units.packaging')}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{t('units.packagingHelp')}</p>
                </div>
              )}
            </div>
          )}
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setEdit(null)}>{tCommon('cancel')}</CmxButton>
            <CmxButton loading={busy} disabled={!edit || !edit.draft.name || !edit.draft.symbol || !edit.draft.code || !baseRateOk || !uneceOk} onClick={save}>{tCommon('save')}</CmxButton>
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
                <CmxButton size="sm" variant="outline" onClick={() => void addable.refetch()}>{tCommon('retry')}</CmxButton>
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
          await run(() => uomApi.resetUnit(resetCode), 'units.reset', () => setResetCode(null));
        }}
      />
    </div>
  );
}
