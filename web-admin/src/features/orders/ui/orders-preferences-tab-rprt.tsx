'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Settings2, Package, Layers, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { Badge } from '@ui/primitives';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxDataGrid } from '@ui/data-display/cmx-data-grid';
import {
  ORDER_PREF_DTL_DISPLAY_COLUMNS,
  type OrderPreferenceDtlColumn,
  type OrderPreferenceRow,
} from '@/lib/orders/order-preferences-dtl';

/** Columns hidden below `md` to reduce horizontal scroll on smaller viewports. */
const PREF_GRID_HIDE_MD_COLS = new Set<OrderPreferenceDtlColumn>([
  'tenant_org_id',
  'order_id',
  'branch_id',
  'order_item_id',
  'order_item_piece_id',
  'preference_id',
  'preference_category',
  'rec_status',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
  'confirmed_by',
  'confirmed_at',
]);

/** IDs and codes where copy-to-clipboard is high value (not booleans/dates/status chips). */
const PREF_GRID_COPYABLE_COLS = new Set<OrderPreferenceDtlColumn>([
  'id',
  'tenant_org_id',
  'order_id',
  'branch_id',
  'order_item_id',
  'order_item_piece_id',
  'preference_id',
  'preference_code',
]);

interface OrdersPreferencesTabRprtProps {
  preferences: OrderPreferenceRow[];
  currencyCode: string;
  locale: 'en' | 'ar';
  /** Localized header labels keyed by org_order_preferences_dtl column name */
  dtlColumnLabels: Record<OrderPreferenceDtlColumn, string>;
  translations: {
    emptyPreferences: string;
    levelOrder: string;
    levelItem: string;
    levelPiece: string;
    kindServicePrefs: string;
    kindPackingPrefs: string;
    kindConditionStain: string;
    kindConditionDamage: string;
    kindColor: string;
    kindNote: string;
    ownerSystem: string;
    ownerOverride: string;
    sourceOrderCreate: string;
    sourceManual: string;
    sourceOrderUpdate: string;
    totalExtraCharge: string;
    orderLevelPrefs: string;
    itemLevelPrefs: string;
    pieceLevelPrefs: string;
    rowCountSuffix: string;
    paginationRowsPerPage: string;
    paginationShowing: string;
    paginationPrevious: string;
    paginationNext: string;
    paginationPageOf: string;
    paginationFirst: string;
    paginationLast: string;
    paginationGoToPage: string;
    paginationGo: string;
    paginationResetFilters: string;
    paginationFilterPlaceholder: string;
    paginationEmptyFiltered: string;
    paginationGlobalSearchPlaceholder: string;
    paginationExportCsv: string;
    paginationColumnsMenu: string;
    paginationToggleColumns: string;
    paginationClearColumnFilter: string;
    paginationEmptyFilteredHint: string;
    paginationDensity: string;
    paginationDensityCompact: string;
    paginationDensityStandard: string;
    paginationDensityComfortable: string;
    paginationCopyToClipboard: string;
    valueYes: string;
    valueNo: string;
  };
}

const LEVEL_ORDER = 'ORDER';
const LEVEL_ITEM = 'ITEM';
const LEVEL_PIECE = 'PIECE';

function LevelIcon({ level }: { level: string }) {
  if (level === LEVEL_ORDER) return <Layers className="w-4 h-4 text-blue-500" />;
  if (level === LEVEL_ITEM) return <Package className="w-4 h-4 text-purple-500" />;
  return <Settings2 className="w-4 h-4 text-orange-500" />;
}

function kindBadge(kind: string | null, t: OrdersPreferencesTabRprtProps['translations']) {
  const map: Record<string, { label: string; cls: string }> = {
    service_prefs: { label: t.kindServicePrefs, cls: 'bg-blue-100 text-blue-800' },
    packing_prefs: { label: t.kindPackingPrefs, cls: 'bg-green-100 text-green-800' },
    condition_stain: { label: t.kindConditionStain, cls: 'bg-red-100 text-red-800' },
    condition_damag: { label: t.kindConditionDamage, cls: 'bg-orange-100 text-orange-800' },
    color: { label: t.kindColor, cls: 'bg-pink-100 text-pink-800' },
    note: { label: t.kindNote, cls: 'bg-gray-100 text-gray-700' },
  };
  const entry = map[kind ?? ''];
  if (!entry) return <Badge variant="outline">{kind ?? '—'}</Badge>;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${entry.cls}`}>{entry.label}</span>;
}

function ownerBadge(owner: string, t: OrdersPreferencesTabRprtProps['translations']) {
  if (owner === 'OVERRIDE')
    return <Badge variant="destructive" className="text-xs">{t.ownerOverride}</Badge>;
  return <Badge variant="secondary" className="text-xs">{t.ownerSystem}</Badge>;
}

function sourceLabel(source: string, t: OrdersPreferencesTabRprtProps['translations']) {
  const map: Record<string, string> = {
    ORDER_CREATE: t.sourceOrderCreate,
    MANUAL: t.sourceManual,
    ORDER_UPDATE: t.sourceOrderUpdate,
  };
  return map[source] ?? source;
}

function formatDateTime(value: string | null, locale: 'en' | 'ar') {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(locale === 'ar' ? 'ar' : 'en', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function UuidCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-gray-400">—</span>;
  return (
    <span className="font-mono text-xs text-gray-700 max-w-[11rem] inline-block truncate align-bottom" title={value}>
      {value}
    </span>
  );
}

function renderDtlCell(
  col: OrderPreferenceDtlColumn,
  pref: OrderPreferenceRow,
  t: OrdersPreferencesTabRprtProps['translations'],
  currencyCode: string,
  locale: 'en' | 'ar'
): ReactNode {
  switch (col) {
    case 'id':
      return <UuidCell value={pref.id} />;
    case 'tenant_org_id':
      return <UuidCell value={pref.tenant_org_id} />;
    case 'order_id':
      return <UuidCell value={pref.order_id} />;
    case 'branch_id':
      return <UuidCell value={pref.branch_id} />;
    case 'order_item_id':
      return <UuidCell value={pref.order_item_id} />;
    case 'order_item_piece_id':
      return <UuidCell value={pref.order_item_piece_id} />;
    case 'preference_id':
      return <UuidCell value={pref.preference_id} />;
    case 'prefs_no':
      return <span className="tabular-nums text-gray-800">{pref.prefs_no}</span>;
    case 'prefs_level':
      return (
        <span className="inline-flex items-center gap-1">
          <LevelIcon level={pref.prefs_level} />
          <span className="text-xs font-medium">{pref.prefs_level}</span>
        </span>
      );
    case 'preference_code':
      return <span className="font-medium text-gray-900">{pref.preference_code}</span>;
    case 'preference_sys_kind':
      return kindBadge(pref.preference_sys_kind, t);
    case 'preference_category':
      return <span className="text-xs text-gray-700">{pref.preference_category ?? '—'}</span>;
    case 'prefs_owner_type':
      return ownerBadge(pref.prefs_owner_type, t);
    case 'prefs_source':
      return <span className="text-xs text-gray-600">{sourceLabel(pref.prefs_source, t)}</span>;
    case 'extra_price':
      return pref.extra_price > 0 ? (
        <span className="text-green-700 font-medium tabular-nums text-xs">
          +{pref.extra_price.toLocaleString(locale === 'ar' ? 'ar' : 'en', { minimumFractionDigits: 2 })} {currencyCode}
        </span>
      ) : (
        <span className="text-gray-400">—</span>
      );
    case 'processing_confirmed':
      if (pref.processing_confirmed === true) {
        return (
          <span className="inline-flex items-center gap-1 text-green-700 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t.valueYes}
          </span>
        );
      }
      if (pref.processing_confirmed === false) {
        return (
          <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
            <Clock className="w-3.5 h-3.5" />
            {t.valueNo}
          </span>
        );
      }
      return <span className="text-gray-400">—</span>;
    case 'confirmed_by':
      return <span className="text-xs text-gray-700">{pref.confirmed_by ?? '—'}</span>;
    case 'created_by':
      return <span className="text-xs text-gray-700">{pref.created_by ?? '—'}</span>;
    case 'updated_by':
      return <span className="text-xs text-gray-700">{pref.updated_by ?? '—'}</span>;
    case 'confirmed_at':
    case 'created_at':
    case 'updated_at': {
      const raw =
        col === 'confirmed_at' ? pref.confirmed_at : col === 'created_at' ? pref.created_at : pref.updated_at;
      const formatted = formatDateTime(raw, locale);
      return <span className="text-xs text-gray-600 whitespace-nowrap">{formatted ?? '—'}</span>;
    }
    case 'rec_status':
      return <span className="tabular-nums text-xs">{pref.rec_status ?? '—'}</span>;
    default:
      return <span className="text-gray-400">—</span>;
  }
}

interface PrefGroupProps {
  prefs: OrderPreferenceRow[];
  title: string;
  icon: React.ReactNode;
  isRTL: boolean;
  currencyCode: string;
  locale: 'en' | 'ar';
  t: OrdersPreferencesTabRprtProps['translations'];
  dtlColumnLabels: Record<OrderPreferenceDtlColumn, string>;
  /** Stable key for column visibility persistence (not localized title). */
  columnVisibilityStorageKey: string;
}

function PrefGroup({ prefs, title, icon, isRTL, currencyCode, locale, t, dtlColumnLabels, columnVisibilityStorageKey }: PrefGroupProps) {
  const columns = useMemo(
    (): ColumnDef<OrderPreferenceRow, unknown>[] =>
      ORDER_PREF_DTL_DISPLAY_COLUMNS.map((col) => ({
        accessorKey: col,
        header: () => dtlColumnLabels[col],
        cell: ({ row }) => renderDtlCell(col, row.original, t, currencyCode, locale),
        meta:
          PREF_GRID_HIDE_MD_COLS.has(col) || PREF_GRID_COPYABLE_COLS.has(col)
            ? {
                ...(PREF_GRID_HIDE_MD_COLS.has(col) ? { hideBelow: 'md' as const } : {}),
                ...(PREF_GRID_COPYABLE_COLS.has(col) ? { isCopyable: true as const } : {}),
              }
            : undefined,
      })),
    [dtlColumnLabels, t, currencyCode, locale]
  );

  if (prefs.length === 0) return null;

  const totalExtra = prefs.reduce((sum, p) => sum + p.extra_price, 0);
  const hasCharges = totalExtra > 0;

  const gridLabels = {
    resetFilters: t.paginationResetFilters,
    rowsPerPage: t.paginationRowsPerPage,
    showing: t.paginationShowing,
    page: t.paginationPageOf,
    firstPage: t.paginationFirst,
    previousPage: t.paginationPrevious,
    nextPage: t.paginationNext,
    lastPage: t.paginationLast,
    goToPage: t.paginationGoToPage,
    go: t.paginationGo,
    filterPlaceholder: t.paginationFilterPlaceholder,
    empty: t.paginationEmptyFiltered,
    columnsMenu: t.paginationColumnsMenu,
    toggleColumns: t.paginationToggleColumns,
    globalSearchPlaceholder: t.paginationGlobalSearchPlaceholder,
    clearFilters: t.paginationResetFilters,
    exportCsv: t.paginationExportCsv,
    clearColumnFilter: t.paginationClearColumnFilter,
    emptyFilteredHint: t.paginationEmptyFilteredHint,
    density: t.paginationDensity,
    densityCompact: t.paginationDensityCompact,
    densityStandard: t.paginationDensityStandard,
    densityComfortable: t.paginationDensityComfortable,
    copyToClipboard: t.paginationCopyToClipboard,
  };

  const exportBasename =
    title === t.orderLevelPrefs
      ? 'order-preferences-order-level'
      : title === t.itemLevelPrefs
        ? 'order-preferences-item-level'
        : 'order-preferences-piece-level';

  return (
    <CmxCard>
      <CmxCardHeader className="pb-2">
        <CmxCardTitle className={`text-sm font-semibold flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {icon}
          <span>{title}</span>
          <span className="text-gray-400 font-normal text-xs">({prefs.length})</span>
          {hasCharges && (
            <span className={`${isRTL ? 'mr-auto' : 'ml-auto'} flex items-center gap-1 text-xs text-green-700 font-medium`}>
              <DollarSign className="w-3 h-3" />
              {t.totalExtraCharge}: {totalExtra.toLocaleString(locale === 'ar' ? 'ar' : 'en', { minimumFractionDigits: 2 })} {currencyCode}
            </span>
          )}
        </CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="pt-0 min-h-0">
        <CmxDataGrid
          data={prefs}
          columns={columns}
          getRowId={(row) => row.id}
          initialPageSize={10}
          pageSizeOptions={[10, 25, 50, 100]}
          labels={gridLabels}
          dir={isRTL ? 'rtl' : 'ltr'}
          enableZebra
          enableGlobalSearch
          enableExportCsv
          exportFileName={exportBasename}
          enableStickyFirstColumn
          columnVisibilityStorageKey={columnVisibilityStorageKey}
          enableDensityToggle
          tableWrapperClassName="max-h-[min(48vh,26rem)] min-w-0"
        />
      </CmxCardContent>
    </CmxCard>
  );
}

/**
 * Order full-details Preferences tab: every `org_order_preferences_dtl` column per row.
 * @param props - Tab props (preferences, currency, locale, column labels, translations)
 * @returns Preferences tab content
 */
export function OrdersPreferencesTabRprt(props: OrdersPreferencesTabRprtProps) {
  const { preferences, currencyCode, locale, dtlColumnLabels, translations: t } = props;
  const isRTL = useRTL();

  if (preferences.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
        <Settings2 className="w-12 h-12 mb-3 text-gray-300" />
        <p className="text-sm">{t.emptyPreferences}</p>
      </div>
    );
  }

  const orderLevel = preferences.filter((p) => p.prefs_level === LEVEL_ORDER);
  const itemLevel = preferences.filter((p) => p.prefs_level === LEVEL_ITEM);
  const pieceLevel = preferences.filter((p) => p.prefs_level === LEVEL_PIECE);

  const totalExtra = preferences.reduce((sum, p) => sum + p.extra_price, 0);
  const hasAnyCharge = totalExtra > 0;

  return (
    <div className="flex min-h-0 max-h-full flex-1 flex-col gap-4">
      <div className={`shrink-0 flex flex-wrap gap-4 items-center p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
        <span className="text-gray-600 font-medium">
          {preferences.length} {t.rowCountSuffix}
        </span>
        <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {orderLevel.length > 0 && (
            <span className="inline-flex items-center gap-1 text-blue-700">
              <Layers className="w-3.5 h-3.5" />
              {t.levelOrder}: {orderLevel.length}
            </span>
          )}
          {itemLevel.length > 0 && (
            <span className="inline-flex items-center gap-1 text-purple-700">
              <Package className="w-3.5 h-3.5" />
              {t.levelItem}: {itemLevel.length}
            </span>
          )}
          {pieceLevel.length > 0 && (
            <span className="inline-flex items-center gap-1 text-orange-700">
              <Settings2 className="w-3.5 h-3.5" />
              {t.levelPiece}: {pieceLevel.length}
            </span>
          )}
        </div>
        {hasAnyCharge && (
          <span className={`${isRTL ? 'mr-auto' : 'ml-auto'} flex items-center gap-1 font-semibold text-green-700`}>
            <DollarSign className="w-4 h-4" />
            {t.totalExtraCharge}: {totalExtra.toLocaleString(locale === 'ar' ? 'ar' : 'en', { minimumFractionDigits: 2 })} {currencyCode}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pe-1">
        <PrefGroup
          prefs={orderLevel}
          title={t.orderLevelPrefs}
          icon={<Layers className="w-4 h-4 text-blue-500" />}
          isRTL={isRTL}
          currencyCode={currencyCode}
          locale={locale}
          t={t}
          dtlColumnLabels={dtlColumnLabels}
          columnVisibilityStorageKey="cmx-grid:order-full-prefs:order"
        />
        <PrefGroup
          prefs={itemLevel}
          title={t.itemLevelPrefs}
          icon={<Package className="w-4 h-4 text-purple-500" />}
          isRTL={isRTL}
          currencyCode={currencyCode}
          locale={locale}
          t={t}
          dtlColumnLabels={dtlColumnLabels}
          columnVisibilityStorageKey="cmx-grid:order-full-prefs:item"
        />
        <PrefGroup
          prefs={pieceLevel}
          title={t.pieceLevelPrefs}
          icon={<Settings2 className="w-4 h-4 text-orange-500" />}
          isRTL={isRTL}
          currencyCode={currencyCode}
          locale={locale}
          t={t}
          dtlColumnLabels={dtlColumnLabels}
          columnVisibilityStorageKey="cmx-grid:order-full-prefs:piece"
        />
      </div>
    </div>
  );
}
