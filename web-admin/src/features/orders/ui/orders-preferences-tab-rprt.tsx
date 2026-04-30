'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Settings2, Package, Layers, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { Badge } from '@ui/primitives';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card';
import {
  type OrderPreferenceRow,
  ORDER_PREF_DTL_DISPLAY_COLUMNS,
  type OrderPreferenceDtlColumn,
} from '@/app/actions/orders/get-order-preferences';

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function fillPlaceholders(template: string, vars: Record<string, string | number>): string {
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

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
}

function PrefGroup({ prefs, title, icon, isRTL, currencyCode, locale, t, dtlColumnLabels }: PrefGroupProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);

  const total = prefs.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [total, title]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (total === 0) return null;

  const totalExtra = prefs.reduce((sum, p) => sum + p.extra_price, 0);
  const hasCharges = totalExtra > 0;
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, total);
  const slice = prefs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <CmxCard>
      <CmxCardHeader className="pb-2">
        <CmxCardTitle className={`text-sm font-semibold flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {icon}
          <span>{title}</span>
          <span className="text-gray-400 font-normal text-xs">({total})</span>
          {hasCharges && (
            <span className={`${isRTL ? 'mr-auto' : 'ml-auto'} flex items-center gap-1 text-xs text-green-700 font-medium`}>
              <DollarSign className="w-3 h-3" />
              {t.totalExtraCharge}: {totalExtra.toLocaleString(locale === 'ar' ? 'ar' : 'en', { minimumFractionDigits: 2 })} {currencyCode}
            </span>
          )}
        </CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="pt-0 flex flex-col gap-0 min-h-0">
        <div
          className="overflow-auto max-h-[min(48vh,26rem)] rounded-md border border-gray-200 bg-white"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <table className="min-w-[72rem] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
              <tr>
                {ORDER_PREF_DTL_DISPLAY_COLUMNS.map((col) => (
                  <th
                    key={col}
                    className={`px-2 py-2 text-xs font-medium text-gray-600 whitespace-nowrap bg-gray-50 ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {dtlColumnLabels[col]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map((pref) => (
                <tr key={pref.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  {ORDER_PREF_DTL_DISPLAY_COLUMNS.map((col) => (
                    <td key={col} className={`px-2 py-2 align-top ${isRTL ? 'text-right' : 'text-left'}`}>
                      {renderDtlCell(col, pref, t, currencyCode, locale)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className={`mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-600 ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <label className={`inline-flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="whitespace-nowrap">{t.paginationRowsPerPage}</span>
            <select
              className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-800"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label={t.paginationRowsPerPage}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span className="tabular-nums whitespace-nowrap">
            {fillPlaceholders(t.paginationShowing, { from, to, total })}
          </span>
          <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="tabular-nums whitespace-nowrap text-gray-500">
              {fillPlaceholders(t.paginationPageOf, { current: currentPage, totalPages })}
            </span>
            <div className={`flex gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-gray-300 px-2 py-1 text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t.paginationPrevious}
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border border-gray-300 px-2 py-1 text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t.paginationNext}
              </button>
            </div>
          </div>
        </div>
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
        />
      </div>
    </div>
  );
}
