/**
 * Preferences Catalog Page
 * Service and packing preferences catalog; Care Package bundles CRUD
 * Route: /dashboard/catalog/preferences
 * Migration 0139: Order Service Preferences
 *
 * Multi-tab layout: Service Preferences | Packing Preferences | Care Packages
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAlertDialog, useMessage } from '@ui/feedback';
import { usePreferenceBundles } from '@/src/features/orders/hooks/use-preference-bundles';
import { CmxCard } from '@ui/primitives/cmx-card';
import { CmxButton, CmxInput, CmxSelect, CmxSwitch } from '@ui/primitives';
import { CmxHexColorField } from '@ui/forms';
import { Badge } from '@ui/primitives/badge';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogClose,
} from '@ui/overlays';
import { CmxTabsPanel } from '@ui/navigation';
import { Package, Shirt, Plus, Pencil, Trash2, Gift, ChevronRight, Layers } from 'lucide-react';
import { RequireAnyPermission } from '@/src/features/auth/ui/RequirePermission';
import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode, type MoneyLocale } from '@/lib/money/format-money';
import { CATALOG_PREFERENCES_ACCESS } from '@features/catalog/access/catalog-access';
import { ORG_SERVICE_PREFERENCE_CATEGORY_OPTIONS, PREFERENCE_CATEGORIES } from '@/lib/constants/service-preferences';
import { normalizeHexDraftForApi } from '@/lib/utils/color-hex';
import type { ColumnDef } from '@tanstack/react-table';
import { CmxDataGrid, type CmxDataGridLabels, type CmxDataGridColumnMeta } from '@ui/data-display';
import { useHasAnyPermission } from '@/lib/hooks/usePermissions';

interface ServicePref {
  code: string;
  name: string;
  name2?: string | null;
  preference_category?: string;
  preference_sys_kind?: string | null;
  default_extra_price?: number;
  extra_turnaround_minutes?: number;
  is_active?: boolean;
  color_hex?: string | null;
}

interface PackingPref {
  code: string;
  name: string;
  name2?: string | null;
  maps_to_packaging_type?: string;
  is_active?: boolean;
}

interface ServicePrefAdmin {
  code: string;
  name: string | null;
  name2: string | null;
  preference_category: string | null;
  preference_sys_kind: string | null;
  default_extra_price: number;
  display_order: number;
  sys_is_active: boolean;
  color_hex: string | null;
  cf_id: string | null;
  cf_name: string | null;
  cf_name2: string | null;
  cf_extra_price: number | null;
  cf_is_included_in_base: boolean | null;
  cf_is_active: boolean | null;
  cf_display_order: number | null;
  cf_color_hex: string | null;
}

interface PackingPrefAdmin {
  code: string;
  name: string | null;
  name2: string | null;
  maps_to_packaging_type: string | null;
  display_order: number;
  sys_is_active: boolean;
  cf_id: string | null;
  cf_name: string | null;
  cf_name2: string | null;
  cf_extra_price: number | null;
  cf_is_active: boolean | null;
  cf_display_order: number | null;
}

interface PreferenceBundle {
  id: string;
  bundle_code: string;
  name: string;
  name2?: string | null;
  preference_codes?: string[] | null;
  discount_percent?: number;
  discount_amount?: number;
  is_active?: boolean;
  display_order?: number;
}

function bundleDiscountDisplay(
  b: PreferenceBundle,
  opts: { currencyCode: string; decimalPlaces: number; locale: MoneyLocale }
): string {
  if ((b.discount_percent ?? 0) > 0) return `${b.discount_percent}%`;
  if ((b.discount_amount ?? 0) > 0) {
    return formatMoneyAmountWithCode(Number(b.discount_amount), {
      currencyCode: opts.currencyCode,
      decimalPlaces: opts.decimalPlaces,
      locale: opts.locale,
    });
  }
  return '—';
}

type ServicePrefRow = ServicePref | ServicePrefAdmin;

type PackingPrefRow = PackingPref | PackingPrefAdmin;

type CatalogOfferFilter = 'all' | 'offered' | 'not_offered';

function formatPreferenceKindCode(kindCode: string) {
  return kindCode
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getServicePrefKind(row: ServicePrefRow) {
  return row.preference_sys_kind || 'service_prefs';
}

function isColorPreferenceGroupOrRow(rowOrKind: ServicePrefRow | string): boolean {
  if (typeof rowOrKind === 'string') {
    return rowOrKind === 'color';
  }
  return (
    getServicePrefKind(rowOrKind) === 'color' ||
    rowOrKind.preference_category === 'color'
  );
}

function CatalogOfferFilterBar({
  value,
  onChange,
}: {
  value: CatalogOfferFilter;
  onChange: (v: CatalogOfferFilter) => void;
}) {
  const t = useTranslations('catalog.preferences');
  const btn = (id: CatalogOfferFilter, label: string) => (
    <CmxButton
      type="button"
      size="sm"
      variant={value === id ? 'primary' : 'outline'}
      onClick={() => onChange(id)}
      aria-pressed={value === id}
      data-testid={`catalog-filter-${id}`}
    >
      {label}
    </CmxButton>
  );

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={t('catalogFilterGroup', { defaultValue: 'Catalog visibility' })}
    >
      {btn('all', t('filterAll', { defaultValue: 'All' }))}
      {btn('offered', t('filterOffered', { defaultValue: 'In catalog' }))}
      {btn('not_offered', t('filterNotOffered', { defaultValue: 'Not in catalog' }))}
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]">
      <table className="min-w-full text-sm">
        <thead className="bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))]">
          <tr>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <th key={i} className="px-4 py-3 text-left">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-t border-gray-100">
              {[1, 2, 3, 4, 5, 6].map((j) => (
                <td key={j} className="px-4 py-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useCatalogPreferencesGridLabels(): Partial<CmxDataGridLabels> {
  const t = useTranslations('catalog.preferences');
  return useMemo(
    () => ({
      resetFilters: t('dataGrid.resetFilters'),
      rowsPerPage: t('dataGrid.rowsPerPage'),
      showing: t('dataGrid.showing'),
      page: t('dataGrid.page'),
      firstPage: t('dataGrid.firstPage'),
      previousPage: t('dataGrid.previousPage'),
      nextPage: t('dataGrid.nextPage'),
      lastPage: t('dataGrid.lastPage'),
      goToPage: t('dataGrid.goToPage'),
      go: t('dataGrid.go'),
      filterPlaceholder: t('dataGrid.filterPlaceholder'),
      empty: t('dataGrid.empty'),
      columnsMenu: t('dataGrid.columnsMenu'),
      toggleColumns: t('dataGrid.toggleColumns'),
      globalSearchPlaceholder: t('dataGrid.globalSearchPlaceholder'),
      clearFilters: t('dataGrid.clearFilters'),
      exportCsv: t('dataGrid.exportCsv'),
      selectedCount: t('dataGrid.selectedCount'),
      selectAll: t('dataGrid.selectAll'),
      selectRow: t('dataGrid.selectRow'),
      clearColumnFilter: t('dataGrid.clearColumnFilter'),
      emptyFilteredHint: t('dataGrid.emptyFilteredHint'),
      density: t('dataGrid.density'),
      densityCompact: t('dataGrid.densityCompact'),
      densityStandard: t('dataGrid.densityStandard'),
      densityComfortable: t('dataGrid.densityComfortable'),
      copyToClipboard: t('dataGrid.copyToClipboard'),
    }),
    [t]
  );
}

function servicePrefPrimaryLabel(row: ServicePrefRow, isAdmin: boolean, isRtl: boolean): string {
  const adminRow = isAdmin ? (row as ServicePrefAdmin) : null;
  const displayName = adminRow ? (adminRow.cf_name ?? adminRow.name ?? '') : ((row as ServicePref).name ?? '');
  const displayName2 = adminRow ? (adminRow.cf_name2 ?? adminRow.name2 ?? '') : ((row as ServicePref).name2 ?? '');
  const primary = isRtl ? (displayName2 || displayName) : displayName;
  return primary.trim() || '—';
}

function servicePrefSecondaryLabel(row: ServicePrefRow, isAdmin: boolean): string {
  const adminRow = isAdmin ? (row as ServicePrefAdmin) : null;
  const displayName2 = adminRow ? (adminRow.cf_name2 ?? adminRow.name2 ?? '') : ((row as ServicePref).name2 ?? '');
  return displayName2.trim() || '—';
}

function servicePrefExtraPriceValue(row: ServicePrefRow, isAdmin: boolean): number {
  if (isAdmin) {
    const a = row as ServicePrefAdmin;
    return Number(a.cf_extra_price ?? a.default_extra_price ?? 0);
  }
  return Number((row as ServicePref).default_extra_price ?? 0);
}

function servicePrefSwatchHex(row: ServicePrefRow, isAdmin: boolean): string | null {
  if (isAdmin) {
    const a = row as ServicePrefAdmin;
    return a.cf_color_hex ?? a.color_hex ?? null;
  }
  return (row as ServicePref).color_hex ?? null;
}

function ServicePrefsKindDataGrid({
  kindCode,
  groupRows,
  isAdmin,
  isRtl,
  showSwatchCol,
  onEdit,
  onRemove,
  removePendingCode,
  labels,
  columnVisibilityStorageKey,
}: {
  kindCode: string;
  groupRows: ServicePrefRow[];
  isAdmin: boolean;
  isRtl: boolean;
  showSwatchCol: boolean;
  onEdit: (p: ServicePrefAdmin) => void;
  onRemove?: (p: ServicePrefAdmin) => void;
  removePendingCode: string | null;
  labels: Partial<CmxDataGridLabels>;
  columnVisibilityStorageKey: string;
}) {
  const t = useTranslations('catalog.preferences');
  const dir = isRtl ? 'rtl' : 'ltr';
  const intlLocale = useLocale();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const moneyLocale: MoneyLocale = intlLocale === 'ar' ? 'ar' : 'en';
  const editPerms = CATALOG_PREFERENCES_ACCESS.actions?.editServicePreferences.requirement.permissions ?? [];

  const columns = useMemo((): ColumnDef<ServicePrefRow, unknown>[] => {
    const cols: ColumnDef<ServicePrefRow, unknown>[] = [
      {
        accessorKey: 'code',
        header: t('code', { defaultValue: 'Code' }),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.code}</span>
        ),
      },
    ];

    if (showSwatchCol) {
      cols.push({
        id: 'swatch',
        enableSorting: false,
        meta: { disableFilter: true } satisfies CmxDataGridColumnMeta,
        header: t('preferenceColorShort', { defaultValue: 'Swatch' }),
        cell: ({ row }) => {
          const swatchHex = servicePrefSwatchHex(row.original, isAdmin);
          return swatchHex ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="h-7 w-7 shrink-0 rounded-full border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] shadow-inner"
                style={{ backgroundColor: swatchHex }}
                title={swatchHex}
                aria-hidden
              />
              <span className="font-mono text-[11px] text-gray-600 max-w-[5.5rem] truncate" dir="ltr" lang="en">
                {swatchHex}
              </span>
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          );
        },
      });
    }

    cols.push(
      {
        id: 'name',
        accessorFn: (r) => servicePrefPrimaryLabel(r, isAdmin, isRtl),
        header: t('name', { defaultValue: 'Name' }),
        meta: { filterable: true } as CmxDataGridColumnMeta & { filterable?: boolean },
        cell: ({ row }) => <span>{servicePrefPrimaryLabel(row.original, isAdmin, isRtl)}</span>,
      },
      {
        id: 'name2',
        accessorFn: (r) => servicePrefSecondaryLabel(r, isAdmin),
        header: t('nameAr', { defaultValue: 'Name (AR)' }),
        meta: { filterable: true } as CmxDataGridColumnMeta & { filterable?: boolean },
        cell: ({ row }) => (
          <span className="text-gray-600">{servicePrefSecondaryLabel(row.original, isAdmin)}</span>
        ),
      },
      {
        accessorKey: 'preference_category',
        header: t('category', { defaultValue: 'Category' }),
        cell: ({ row }) => (
          <span className="text-gray-600">{row.original.preference_category ?? '—'}</span>
        ),
      },
      {
        id: 'extra_price',
        accessorFn: (r) => servicePrefExtraPriceValue(r, isAdmin),
        header: t('extraPrice', { defaultValue: 'Extra Price' }),
        meta: { filterable: true } as CmxDataGridColumnMeta & { filterable?: boolean },
        cell: ({ row }) => (
          <span>
            +
            {formatMoneyAmountWithCode(servicePrefExtraPriceValue(row.original, isAdmin), {
              currencyCode,
              decimalPlaces,
              locale: moneyLocale,
            })}
          </span>
        ),
      },
      {
        id: 'status',
        accessorFn: (r) => {
          const adminRow = isAdmin ? (r as ServicePrefAdmin) : null;
          if (adminRow && !adminRow.cf_id) return -1;
          if (adminRow) return adminRow.cf_is_active !== false ? 1 : 0;
          return 1;
        },
        header: t('status', { defaultValue: 'Status' }),
        cell: ({ row }) => {
          const adminRow = isAdmin ? (row.original as ServicePrefAdmin) : null;
          const rowEnabled =
            adminRow && !adminRow.cf_id ? null : adminRow ? adminRow.cf_is_active !== false : true;
          if (rowEnabled === null) {
            return <span className="text-xs text-gray-400">—</span>;
          }
          return (
            <Badge variant={rowEnabled ? 'success' : 'default'}>
              {rowEnabled ? t('active', { defaultValue: 'Active' }) : t('inactive', { defaultValue: 'Inactive' })}
            </Badge>
          );
        },
      },
    );

    if (isAdmin) {
      cols.push(
        {
          id: 'catalog',
          accessorFn: (r) => (Boolean((r as ServicePrefAdmin).cf_id) ? 1 : 0),
          header: t('catalogColumn', { defaultValue: 'Catalog' }),
          cell: ({ row }) => {
            const adminRow = row.original as ServicePrefAdmin;
            const sysActive = adminRow.sys_is_active !== false;
            const inCatalog = Boolean(adminRow.cf_id);
            return (
              <div className="flex flex-col gap-1">
                <Badge variant={inCatalog ? 'success' : 'default'}>
                  {inCatalog
                    ? t('catalogOffered', { defaultValue: 'In catalog' })
                    : t('catalogNotOffered', { defaultValue: 'Not in catalog' })}
                </Badge>
                {!sysActive ? (
                  <span className="text-xs text-amber-700">
                    {t('systemInactive', { defaultValue: 'Unavailable at platform' })}
                  </span>
                ) : null}
              </div>
            );
          },
        },
        {
          id: 'actions',
          enableSorting: false,
          meta: { disableFilter: true } satisfies CmxDataGridColumnMeta,
          header: t('actions', { defaultValue: 'Actions' }),
          cell: ({ row }) => {
            const adminRow = row.original as ServicePrefAdmin;
            const sysActive = adminRow.sys_is_active !== false;
            const inCatalog = Boolean(adminRow.cf_id);
            return (
              <RequireAnyPermission permissions={editPerms} fallback={null}>
                <div className="flex justify-end gap-1">
                  {!inCatalog && sysActive ? (
                    <CmxButton
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                      onClick={() => onEdit(adminRow)}
                      aria-label={t('enablePreference', { defaultValue: 'Add to catalog' })}
                      title={t('enablePreference', { defaultValue: 'Add to catalog' })}
                      data-testid={`add-service-pref-${adminRow.code}`}
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="hidden min-[480px]:inline">
                        {t('enablePreference', { defaultValue: 'Add to catalog' })}
                      </span>
                    </CmxButton>
                  ) : null}
                  <CmxButton
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => onEdit(adminRow)}
                    disabled={!inCatalog && !sysActive}
                    aria-label={t('edit', { defaultValue: 'Edit' })}
                    data-testid={`edit-service-pref-${adminRow.code}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </CmxButton>
                  {inCatalog && onRemove ? (
                    <CmxButton
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-red-600 hover:text-red-700"
                      onClick={() => onRemove(adminRow)}
                      disabled={removePendingCode === adminRow.code}
                      aria-label={t('removeFromCatalog', { defaultValue: 'Remove from catalog' })}
                      data-testid={`remove-service-pref-${adminRow.code}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </CmxButton>
                  ) : null}
                </div>
              </RequireAnyPermission>
            );
          },
        },
      );
    }

    return cols;
  }, [
    t,
    showSwatchCol,
    isAdmin,
    isRtl,
    currencyCode,
    decimalPlaces,
    moneyLocale,
    onEdit,
    onRemove,
    removePendingCode,
    editPerms,
  ]);

  return (
    <CmxDataGrid<ServicePrefRow>
      data={groupRows}
      columns={columns}
      getRowId={(row) => row.code}
      initialPageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
      labels={labels}
      dir={dir}
      enableZebra
      enableGlobalSearch
      enableExportCsv
      exportFileName={`service-preferences-${kindCode.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
      enableStickyFirstColumn
      columnVisibilityStorageKey={columnVisibilityStorageKey}
      enableDensityToggle
      tableWrapperClassName="max-h-[min(60vh,34rem)] min-w-0"
      enableColumnVisibility
      className="min-w-0"
    />
  );
}

function ServicePrefsTable({
  servicePrefsAdmin,
  servicePrefs,
  preferenceKindsAdmin,
  loading,
  onEdit,
  onRemove,
  offerFilter,
  removePendingCode,
  isRtl,
}: {
  servicePrefsAdmin: ServicePrefAdmin[];
  servicePrefs: ServicePref[];
  preferenceKindsAdmin: PreferenceKindAdmin[];
  loading: boolean;
  onEdit: (p: ServicePrefAdmin) => void;
  onRemove?: (p: ServicePrefAdmin) => void;
  offerFilter: CatalogOfferFilter;
  removePendingCode: string | null;
  isRtl: boolean;
}) {
  const t = useTranslations('catalog.preferences');
  const { currentTenant } = useAuth();
  const gridLabels = useCatalogPreferencesGridLabels();
  const rowsRaw = servicePrefsAdmin.length > 0 ? servicePrefsAdmin : servicePrefs;
  const isAdmin = servicePrefsAdmin.length > 0;
  const rows = useMemo(() => {
    if (!isAdmin || offerFilter === 'all') return rowsRaw;
    return (rowsRaw as ServicePrefAdmin[]).filter((r) => {
      const offered = Boolean(r.cf_id);
      return offerFilter === 'offered' ? offered : !offered;
    });
  }, [rowsRaw, isAdmin, offerFilter]);

  const groupedRows = useMemo(() => {
    const kindMeta = new Map(
      preferenceKindsAdmin.map((kind) => {
        const displayName = isRtl
          ? (kind.cf_name2 ?? kind.name2 ?? kind.cf_name ?? kind.name)
          : (kind.cf_name ?? kind.name ?? kind.cf_name2 ?? kind.name2);

        return [
          kind.kind_code,
          {
            label: displayName || formatPreferenceKindCode(kind.kind_code),
            color: kind.cf_kind_bg_color ?? kind.kind_bg_color,
            order: kind.rec_order ?? Number.MAX_SAFE_INTEGER,
          },
        ];
      })
    );
    const groups = new Map<string, ServicePrefRow[]>();

    for (const row of rows) {
      const kindCode = getServicePrefKind(row);
      const group = groups.get(kindCode) ?? [];
      group.push(row);
      groups.set(kindCode, group);
    }

    return Array.from(groups.entries())
      .map(([kindCode, groupRows], index) => {
        const meta = kindMeta.get(kindCode);

        return {
          kindCode,
          rows: groupRows,
          label: meta?.label ?? formatPreferenceKindCode(kindCode),
          color: meta?.color ?? null,
          order: meta?.order ?? Number.MAX_SAFE_INTEGER - rows.length + index,
        };
      })
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [isRtl, preferenceKindsAdmin, rows]);

  if (loading) {
    return <TableSkeleton rows={6} />;
  }

  if (rows.length === 0) {
    if (isAdmin && rowsRaw.length > 0) {
      return (
        <div
          className="flex flex-col items-center justify-center py-12 text-center text-gray-500"
          data-testid="service-prefs-filter-empty"
        >
          <Shirt className="h-12 w-12 text-gray-300 mb-3" aria-hidden />
          <p className="text-sm font-medium">{t('catalogFilterEmpty', { defaultValue: 'No options match this filter' })}</p>
        </div>
      );
    }
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center text-gray-500"
        data-testid="service-prefs-empty"
      >
        <Shirt className="h-12 w-12 text-gray-300 mb-3" aria-hidden />
        <p className="text-sm font-medium">{t('noServicePrefs', { defaultValue: 'No service preferences configured' })}</p>
      </div>
    );
  }

  return (
    <div
      className="space-y-4"
      data-testid="service-prefs-table"
    >
      {groupedRows.map((group) => {
        const showSwatchCol = isColorPreferenceGroupOrRow(group.kindCode);

        return (
        <section
          key={group.kindCode}
          className="overflow-hidden rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-white"
          data-testid={`service-prefs-group-${group.kindCode}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full border border-white shadow-sm ring-1 ring-gray-200"
                style={{ backgroundColor: group.color ?? 'rgb(var(--cmx-primary-rgb,37_99_235))' }}
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{group.label}</h3>
                <p className="font-mono text-xs text-gray-500">{group.kindCode}</p>
              </div>
            </div>
            <Badge variant="default">
              {group.rows.length} {t('preferences', { defaultValue: 'Preferences' })}
            </Badge>
          </div>
          <div className="overflow-hidden rounded-b-xl">
            <ServicePrefsKindDataGrid
              kindCode={group.kindCode}
              groupRows={group.rows}
              isAdmin={isAdmin}
              isRtl={isRtl}
              showSwatchCol={showSwatchCol}
              onEdit={onEdit}
              onRemove={onRemove}
              removePendingCode={removePendingCode}
              labels={gridLabels}
              columnVisibilityStorageKey={
                currentTenant?.tenant_id
                  ? `catalog-service-prefs-grid-${currentTenant.tenant_id}-${group.kindCode}`
                  : `catalog-service-prefs-grid-${group.kindCode}`
              }
            />
          </div>
        </section>
        );
      })}
    </div>
  );
}

function packingPrefPrimaryLabel(row: PackingPrefRow, isAdmin: boolean, isRtl: boolean): string {
  const adminRow = isAdmin ? (row as PackingPrefAdmin) : null;
  const displayName = adminRow ? (adminRow.cf_name ?? adminRow.name ?? '') : ((row as PackingPref).name ?? '');
  const displayName2 = adminRow ? (adminRow.cf_name2 ?? adminRow.name2 ?? '') : ((row as PackingPref).name2 ?? '');
  const primary = isRtl ? (displayName2 || displayName) : displayName;
  return primary.trim() || '—';
}

function packingPrefSecondaryLabel(row: PackingPrefRow, isAdmin: boolean): string {
  const adminRow = isAdmin ? (row as PackingPrefAdmin) : null;
  const displayName2 = adminRow ? (adminRow.cf_name2 ?? adminRow.name2 ?? '') : ((row as PackingPref).name2 ?? '');
  return displayName2.trim() || '—';
}

function packingPrefPackagingType(row: PackingPrefRow, isAdmin: boolean): string {
  const v = isAdmin
    ? (row as PackingPrefAdmin).maps_to_packaging_type
    : (row as PackingPref).maps_to_packaging_type;
  return (v && String(v).trim()) || '—';
}

function PackingPrefsDataGrid({
  rows,
  isAdmin,
  isRtl,
  onEdit,
  onRemove,
  removePendingCode,
  labels,
  columnVisibilityStorageKey,
}: {
  rows: PackingPrefRow[];
  isAdmin: boolean;
  isRtl: boolean;
  onEdit: (p: PackingPrefAdmin) => void;
  onRemove?: (p: PackingPrefAdmin) => void;
  removePendingCode: string | null;
  labels: Partial<CmxDataGridLabels>;
  columnVisibilityStorageKey: string;
}) {
  const t = useTranslations('catalog.preferences');
  const dir = isRtl ? 'rtl' : 'ltr';
  const packEditPerms = CATALOG_PREFERENCES_ACCESS.actions?.editPackingPreferences.requirement.permissions ?? [];

  const columns = useMemo((): ColumnDef<PackingPrefRow, unknown>[] => {
    const cols: ColumnDef<PackingPrefRow, unknown>[] = [
      {
        accessorKey: 'code',
        header: t('code', { defaultValue: 'Code' }),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
      },
      {
        id: 'name',
        accessorFn: (r) => packingPrefPrimaryLabel(r, isAdmin, isRtl),
        header: t('name', { defaultValue: 'Name' }),
        cell: ({ row }) => <span>{packingPrefPrimaryLabel(row.original, isAdmin, isRtl)}</span>,
      },
      {
        id: 'name2',
        accessorFn: (r) => packingPrefSecondaryLabel(r, isAdmin),
        header: t('nameAr', { defaultValue: 'Name (AR)' }),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{packingPrefSecondaryLabel(row.original, isAdmin)}</span>
        ),
      },
      {
        id: 'maps_to_packaging_type',
        accessorFn: (r) => packingPrefPackagingType(r, isAdmin),
        header: t('packagingType', { defaultValue: 'Packaging Type' }),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{packingPrefPackagingType(row.original, isAdmin)}</span>
        ),
      },
      {
        id: 'status',
        accessorFn: (r) => {
          const adminRow = isAdmin ? (r as PackingPrefAdmin) : null;
          if (adminRow && !adminRow.cf_id) return -1;
          if (adminRow) return adminRow.cf_is_active !== false ? 1 : 0;
          return 1;
        },
        header: t('status', { defaultValue: 'Status' }),
        cell: ({ row }) => {
          const adminRow = isAdmin ? (row.original as PackingPrefAdmin) : null;
          const rowEnabled =
            adminRow && !adminRow.cf_id ? null : adminRow ? adminRow.cf_is_active !== false : true;
          if (rowEnabled === null) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <Badge variant={rowEnabled ? 'success' : 'default'}>
              {rowEnabled ? t('active', { defaultValue: 'Active' }) : t('inactive', { defaultValue: 'Inactive' })}
            </Badge>
          );
        },
      },
    ];

    if (isAdmin) {
      cols.push(
        {
          id: 'catalog',
          accessorFn: (r) => (Boolean((r as PackingPrefAdmin).cf_id) ? 'in-catalog' : 'not-in-catalog'),
          header: t('catalogColumn', { defaultValue: 'Catalog' }),
          cell: ({ row }) => {
            const adminRow = row.original as PackingPrefAdmin;
            const sysActive = adminRow.sys_is_active !== false;
            const inCatalog = Boolean(adminRow.cf_id);
            return (
              <div className="flex flex-col gap-1">
                <Badge variant={inCatalog ? 'success' : 'default'}>
                  {inCatalog
                    ? t('catalogOffered', { defaultValue: 'In catalog' })
                    : t('catalogNotOffered', { defaultValue: 'Not in catalog' })}
                </Badge>
                {!sysActive ? (
                  <span className="text-xs text-amber-700">
                    {t('systemInactive', { defaultValue: 'Unavailable at platform' })}
                  </span>
                ) : null}
              </div>
            );
          },
        },
        {
          id: 'actions',
          enableSorting: false,
          meta: { disableFilter: true } satisfies CmxDataGridColumnMeta,
          header: t('actions', { defaultValue: 'Actions' }),
          cell: ({ row }) => {
            const adminRow = row.original as PackingPrefAdmin;
            const sysActive = adminRow.sys_is_active !== false;
            const inCatalog = Boolean(adminRow.cf_id);
            return (
              <RequireAnyPermission permissions={packEditPerms} fallback={null}>
                <div className="flex justify-end gap-1">
                  {!inCatalog && sysActive ? (
                    <CmxButton
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                      onClick={() => onEdit(adminRow)}
                      aria-label={t('enablePreference', { defaultValue: 'Add to catalog' })}
                      title={t('enablePreference', { defaultValue: 'Add to catalog' })}
                      data-testid={`add-packing-pref-${adminRow.code}`}
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="hidden min-[480px]:inline">
                        {t('enablePreference', { defaultValue: 'Add to catalog' })}
                      </span>
                    </CmxButton>
                  ) : null}
                  <CmxButton
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => onEdit(adminRow)}
                    disabled={!inCatalog && !sysActive}
                    aria-label={t('edit', { defaultValue: 'Edit' })}
                    data-testid={`edit-packing-pref-${adminRow.code}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </CmxButton>
                  {inCatalog && onRemove ? (
                    <CmxButton
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-red-600 hover:text-red-700"
                      onClick={() => onRemove(adminRow)}
                      disabled={removePendingCode === adminRow.code}
                      aria-label={t('removeFromCatalog', { defaultValue: 'Remove from catalog' })}
                      data-testid={`remove-packing-pref-${adminRow.code}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </CmxButton>
                  ) : null}
                </div>
              </RequireAnyPermission>
            );
          },
        },
      );
    }

    return cols;
  }, [t, isAdmin, isRtl, onEdit, onRemove, removePendingCode, packEditPerms]);

  return (
    <CmxDataGrid<PackingPrefRow>
      data={rows}
      columns={columns}
      getRowId={(row) => row.code}
      initialPageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
      labels={labels}
      dir={dir}
      enableZebra
      enableGlobalSearch
      enableExportCsv
      exportFileName="packing-preferences-catalog"
      enableStickyFirstColumn
      columnVisibilityStorageKey={columnVisibilityStorageKey}
      enableDensityToggle
      tableWrapperClassName="max-h-[min(60vh,34rem)] min-w-0"
      enableColumnVisibility
      className="min-w-0"
    />
  );
}

function PackingPrefsTable({
  packingPrefsAdmin,
  packingPrefs,
  loading,
  onEdit,
  onRemove,
  offerFilter,
  removePendingCode,
  isRtl,
}: {
  packingPrefsAdmin: PackingPrefAdmin[];
  packingPrefs: PackingPref[];
  loading: boolean;
  onEdit: (p: PackingPrefAdmin) => void;
  onRemove?: (p: PackingPrefAdmin) => void;
  offerFilter: CatalogOfferFilter;
  removePendingCode: string | null;
  isRtl: boolean;
}) {
  const t = useTranslations('catalog.preferences');
  const { currentTenant } = useAuth();
  const rowsRaw = packingPrefsAdmin.length > 0 ? packingPrefsAdmin : packingPrefs;
  const isAdmin = packingPrefsAdmin.length > 0;
  const gridLabels = useCatalogPreferencesGridLabels();
  const rows = useMemo(() => {
    if (!isAdmin || offerFilter === 'all') return rowsRaw;
    return (rowsRaw as PackingPrefAdmin[]).filter((r) => {
      const offered = Boolean(r.cf_id);
      return offerFilter === 'offered' ? offered : !offered;
    });
  }, [rowsRaw, isAdmin, offerFilter]);

  if (loading) {
    return <TableSkeleton rows={6} />;
  }

  if (rows.length === 0) {
    if (isAdmin && rowsRaw.length > 0) {
      return (
        <div
          className="flex flex-col items-center justify-center py-12 text-center text-gray-500"
          data-testid="packing-prefs-filter-empty"
        >
          <Package className="h-12 w-12 text-gray-300 mb-3" aria-hidden />
          <p className="text-sm font-medium">{t('catalogFilterEmpty', { defaultValue: 'No options match this filter' })}</p>
        </div>
      );
    }
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center text-gray-500"
        data-testid="packing-prefs-empty"
      >
        <Package className="h-12 w-12 text-gray-300 mb-3" aria-hidden />
        <p className="text-sm font-medium">{t('noPackingPrefs', { defaultValue: 'No packing preferences configured' })}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0" data-testid="packing-prefs-table">
      <PackingPrefsDataGrid
        rows={rows as PackingPrefRow[]}
        isAdmin={isAdmin}
        isRtl={isRtl}
        onEdit={onEdit}
        onRemove={onRemove}
        removePendingCode={removePendingCode}
        labels={gridLabels}
        columnVisibilityStorageKey={
          currentTenant?.tenant_id
            ? `catalog-packing-prefs-grid-${currentTenant.tenant_id}`
            : 'catalog-packing-prefs-grid'
        }
      />
    </div>
  );
}

function BundlesTable({
  bundles,
  loading,
  onEdit,
  onDelete,
  deletePending,
}: {
  bundles: PreferenceBundle[];
  loading: boolean;
  onEdit: (b: PreferenceBundle) => void;
  onDelete: (b: PreferenceBundle) => void;
  deletePending: boolean;
}) {
  const t = useTranslations('catalog.preferences');
  const intlLocale = useLocale();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const moneyLocale: MoneyLocale = intlLocale === 'ar' ? 'ar' : 'en';
  const dir = intlLocale === 'ar' ? 'rtl' : 'ltr';
  const { currentTenant } = useAuth();
  const gridLabels = useCatalogPreferencesGridLabels();
  const bundleManagePerms = CATALOG_PREFERENCES_ACCESS.actions?.manageBundles.requirement.permissions ?? [];
  const canManageBundles = useHasAnyPermission(bundleManagePerms);

  const moneyOpts = useMemo(
    () => ({ currencyCode, decimalPlaces, locale: moneyLocale }),
    [currencyCode, decimalPlaces, moneyLocale]
  );

  const columns = useMemo((): ColumnDef<PreferenceBundle, unknown>[] => {
    const cols: ColumnDef<PreferenceBundle, unknown>[] = [
      {
        accessorKey: 'bundle_code',
        header: t('bundleCode', { defaultValue: 'Code' }),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.bundle_code}</span>,
      },
      {
        accessorKey: 'name',
        header: t('bundleName', { defaultValue: 'Name' }),
      },
      {
        id: 'preference_codes',
        accessorFn: (b) => (b.preference_codes || []).join(', '),
        header: t('preferences', { defaultValue: 'Preferences' }),
        meta: { filterable: true } as CmxDataGridColumnMeta & { filterable?: boolean },
        cell: ({ row }) => {
          const text = (row.original.preference_codes || []).join(', ') || '—';
          return (
            <span className="text-muted-foreground block max-w-[200px] truncate" title={text}>
              {text}
            </span>
          );
        },
      },
      {
        id: 'discount',
        accessorFn: (b) => bundleDiscountDisplay(b, moneyOpts),
        header: t('discount', { defaultValue: 'Discount' }),
        meta: { filterable: true } as CmxDataGridColumnMeta & { filterable?: boolean },
        cell: ({ row }) => <span>{bundleDiscountDisplay(row.original, moneyOpts)}</span>,
      },
      {
        id: 'status',
        accessorFn: (b) => (b.is_active ? 1 : 0),
        header: t('status', { defaultValue: 'Status' }),
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? 'success' : 'default'}>
            {row.original.is_active ? t('active', { defaultValue: 'Active' }) : t('inactive', { defaultValue: 'Inactive' })}
          </Badge>
        ),
      },
    ];

    if (canManageBundles) {
      cols.push({
        id: 'actions',
        enableSorting: false,
        meta: { disableFilter: true } satisfies CmxDataGridColumnMeta,
        header: t('actions', { defaultValue: 'Actions' }),
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <CmxButton
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => onEdit(row.original)}
              aria-label={t('edit', { defaultValue: 'Edit' })}
              data-testid={`edit-bundle-${row.original.bundle_code}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </CmxButton>
            <CmxButton
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-red-600 hover:text-red-700"
              onClick={() => onDelete(row.original)}
              disabled={deletePending}
              aria-label={t('delete', { defaultValue: 'Delete' })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </CmxButton>
          </div>
        ),
      });
    }

    return cols;
  }, [t, moneyOpts, canManageBundles, onEdit, onDelete, deletePending]);

  if (loading) {
    return <TableSkeleton rows={5} />;
  }

  if (bundles.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center text-gray-500"
        data-testid="bundles-empty"
      >
        <Gift className="h-12 w-12 text-gray-300 mb-3" aria-hidden />
        <p className="text-sm font-medium">{t('noBundles', { defaultValue: 'No care packages configured' })}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0" data-testid="bundles-table">
      <CmxDataGrid<PreferenceBundle>
        data={bundles}
        columns={columns}
        getRowId={(b) => b.id}
        initialPageSize={25}
        pageSizeOptions={[10, 25, 50, 100]}
        labels={gridLabels}
        dir={dir}
        enableZebra
        enableGlobalSearch
        enableExportCsv
        exportFileName="preference-bundles-catalog"
        enableStickyFirstColumn
        columnVisibilityStorageKey={
          currentTenant?.tenant_id
            ? `catalog-preference-bundles-grid-${currentTenant.tenant_id}`
            : 'catalog-preference-bundles-grid'
        }
        enableDensityToggle
        tableWrapperClassName="max-h-[min(60vh,34rem)] min-w-0"
        enableColumnVisibility
        className="min-w-0"
      />
    </div>
  );
}

interface PreferenceKindAdmin {
  kind_code: string;
  name: string | null;
  name2: string | null;
  kind_bg_color: string | null;
  icon: string | null;
  main_type_code: string | null;
  rec_order: number | null;
  sys_is_active: boolean;
  cf_id: string | null;
  cf_name: string | null;
  cf_name2: string | null;
  cf_kind_bg_color: string | null;
  cf_is_show_in_quick_bar: boolean | null;
  cf_is_show_for_customer: boolean | null;
  cf_is_active: boolean | null;
}

function preferenceKindPrimaryLabel(k: PreferenceKindAdmin, rtl: boolean): string {
  const displayName = k.cf_name ?? k.name ?? '';
  const displayName2 = k.cf_name2 ?? k.name2 ?? '';
  const primary = rtl ? (displayName2 || displayName) : displayName;
  return primary.trim() || '—';
}

function preferenceKindSecondaryLabel(k: PreferenceKindAdmin): string {
  return (k.cf_name2 ?? k.name2 ?? '').trim() || '—';
}

function PreferenceKindsTable({
  kinds,
  loading,
  onEdit,
  isRtl,
}: {
  kinds: PreferenceKindAdmin[];
  loading: boolean;
  onEdit: (k: PreferenceKindAdmin) => void;
  isRtl: boolean;
}) {
  const t = useTranslations('catalog.preferences');
  const dir = isRtl ? 'rtl' : 'ltr';
  const { currentTenant } = useAuth();
  const gridLabels = useCatalogPreferencesGridLabels();
  const kindEditPerms = CATALOG_PREFERENCES_ACCESS.actions?.editPreferenceKinds.requirement.permissions ?? [];
  const canEditKinds = useHasAnyPermission(kindEditPerms);

  const columns = useMemo((): ColumnDef<PreferenceKindAdmin, unknown>[] => {
    const cols: ColumnDef<PreferenceKindAdmin, unknown>[] = [
      {
        accessorKey: 'kind_code',
        header: t('kindCode', { defaultValue: 'Kind Code' }),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.kind_code}</span>,
      },
      {
        id: 'primaryName',
        accessorFn: (k) => preferenceKindPrimaryLabel(k, isRtl),
        header: t('name', { defaultValue: 'Name' }),
        meta: { filterable: true } as CmxDataGridColumnMeta & { filterable?: boolean },
        cell: ({ row }) => <span>{preferenceKindPrimaryLabel(row.original, isRtl)}</span>,
      },
      {
        id: 'name2',
        accessorFn: (k) => preferenceKindSecondaryLabel(k),
        header: t('nameAr', { defaultValue: 'Name (AR)' }),
        meta: { filterable: true } as CmxDataGridColumnMeta & { filterable?: boolean },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{preferenceKindSecondaryLabel(row.original)}</span>
        ),
      },
      {
        accessorKey: 'main_type_code',
        header: t('mainType', { defaultValue: 'Main Type' }),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.main_type_code || '—'}</span>
        ),
      },
      {
        id: 'bg_color',
        enableSorting: false,
        meta: { disableFilter: true } satisfies CmxDataGridColumnMeta,
        header: t('bgColor', { defaultValue: 'BG Color' }),
        cell: ({ row }) => {
          const bgColor = row.original.cf_kind_bg_color ?? row.original.kind_bg_color;
          return bgColor ? (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-4 w-4 rounded-full border border-gray-300"
                style={{ backgroundColor: bgColor }}
                aria-hidden
              />
              <span className="font-mono text-xs text-muted-foreground">{bgColor}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: 'quick_bar',
        accessorFn: (k) => (k.cf_is_show_in_quick_bar ?? false ? 1 : 0),
        header: t('showInQuickBar', { defaultValue: 'Quick Bar' }),
        cell: ({ row }) => {
          const showQuickBar = row.original.cf_is_show_in_quick_bar ?? false;
          return (
            <Badge variant={showQuickBar ? 'success' : 'default'}>
              {showQuickBar ? t('yes', { defaultValue: 'Yes' }) : t('no', { defaultValue: 'No' })}
            </Badge>
          );
        },
      },
      {
        id: 'customer',
        accessorFn: (k) => (k.cf_is_show_for_customer ?? false ? 1 : 0),
        header: t('showForCustomer', { defaultValue: 'Customer' }),
        cell: ({ row }) => {
          const showForCustomer = row.original.cf_is_show_for_customer ?? false;
          return (
            <Badge variant={showForCustomer ? 'success' : 'default'}>
              {showForCustomer ? t('yes', { defaultValue: 'Yes' }) : t('no', { defaultValue: 'No' })}
            </Badge>
          );
        },
      },
      {
        id: 'status',
        accessorFn: (k) => (k.cf_is_active !== false ? 1 : 0),
        header: t('status', { defaultValue: 'Status' }),
        cell: ({ row }) => {
          const isActive = row.original.cf_is_active !== false;
          return (
            <Badge variant={isActive ? 'success' : 'default'}>
              {isActive ? t('active', { defaultValue: 'Active' }) : t('inactive', { defaultValue: 'Inactive' })}
            </Badge>
          );
        },
      },
    ];

    if (canEditKinds) {
      cols.push({
        id: 'actions',
        enableSorting: false,
        meta: { disableFilter: true } satisfies CmxDataGridColumnMeta,
        header: t('actions', { defaultValue: 'Actions' }),
        cell: ({ row }) => (
          <div className="flex justify-end">
            <CmxButton
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => onEdit(row.original)}
              aria-label={t('edit', { defaultValue: 'Edit' })}
              data-testid={`edit-preference-kind-${row.original.kind_code}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </CmxButton>
          </div>
        ),
      });
    }

    return cols;
  }, [t, isRtl, canEditKinds, onEdit]);

  if (loading) {
    return <TableSkeleton rows={6} />;
  }

  if (kinds.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center text-gray-500"
        data-testid="preference-kinds-empty"
      >
        <Layers className="h-12 w-12 text-gray-300 mb-3" aria-hidden />
        <p className="text-sm font-medium">{t('noPreferenceKinds', { defaultValue: 'No preference kinds configured' })}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0" data-testid="preference-kinds-table">
      <CmxDataGrid<PreferenceKindAdmin>
        data={kinds}
        columns={columns}
        getRowId={(k) => k.kind_code}
        initialPageSize={25}
        pageSizeOptions={[10, 25, 50, 100]}
        labels={gridLabels}
        dir={dir}
        enableZebra
        enableGlobalSearch
        enableExportCsv
        exportFileName="preference-kinds-catalog"
        enableStickyFirstColumn
        columnVisibilityStorageKey={
          currentTenant?.tenant_id
            ? `catalog-preference-kinds-grid-${currentTenant.tenant_id}`
            : 'catalog-preference-kinds-grid'
        }
        enableDensityToggle
        tableWrapperClassName="max-h-[min(60vh,34rem)] min-w-0"
        enableColumnVisibility
        className="min-w-0"
      />
    </div>
  );
}

function PreferenceKindEditDialog({
  kind,
  onClose,
  onSuccess,
}: {
  kind: PreferenceKindAdmin;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations('catalog.preferences');
  const tv = useTranslations('validation');
  const [name, setName] = useState(kind.cf_name ?? kind.name ?? '');
  const [name2, setName2] = useState(kind.cf_name2 ?? kind.name2 ?? '');
  const [bgColor, setBgColor] = useState(kind.cf_kind_bg_color ?? kind.kind_bg_color ?? '');
  const [showInQuickBar, setShowInQuickBar] = useState(kind.cf_is_show_in_quick_bar ?? false);
  const [showForCustomer, setShowForCustomer] = useState(kind.cf_is_show_for_customer ?? false);
  const [isActive, setIsActive] = useState(kind.cf_is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const normalizedBg = normalizeHexDraftForApi(bgColor);
      if (normalizedBg === 'invalid') {
        setError(tv('invalidFormat', { defaultValue: 'Invalid format' }));
        return;
      }
      const res = await fetch('/api/v1/catalog/preference-kinds/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader() },
        body: JSON.stringify({
          kindCode: kind.kind_code,
          name: name || null,
          name2: name2 || null,
          kind_bg_color: normalizedBg,
          is_show_in_quick_bar: showInQuickBar,
          is_show_for_customer: showForCustomer,
          is_active: isActive,
        }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to save');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CmxDialog open onOpenChange={(open) => !open && onClose()}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('editPreferenceKind', { defaultValue: 'Edit Preference Kind' })}</CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">{error}</div>
          )}
          <p className="text-sm text-gray-600 font-mono">{kind.kind_code}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('customName', { defaultValue: 'Custom Name (EN)' })}</label>
            <CmxInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind.name ?? kind.kind_code}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('customNameAr', { defaultValue: 'Custom Name (AR)' })}</label>
            <CmxInput
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              placeholder={kind.name2 ?? ''}
              className="w-full"
            />
          </div>
          <CmxHexColorField
            label={t('bgColor', { defaultValue: 'Background Color' })}
            helperText={t('preferenceColorHint', { defaultValue: '#RRGGBB or blank to use catalog default' })}
            hexPlaceholder={t('preferenceColorPlaceholder', { defaultValue: '#1976D2' })}
            pickerAriaLabel={t('colorPickLabel', { defaultValue: 'Open color picker' })}
            clearLabel={t('clearPreferenceColor', { defaultValue: 'Use catalog default' })}
            invalidMessage={tv('invalidFormat', { defaultValue: 'Invalid format' })}
            value={bgColor}
            onChange={setBgColor}
          />
          <div className="flex items-center gap-2">
            <CmxSwitch
              checked={showInQuickBar}
              onCheckedChange={setShowInQuickBar}
            />
            <label className="text-sm text-gray-700">{t('showInQuickBar', { defaultValue: 'Show in Quick Bar' })}</label>
          </div>
          <div className="flex items-center gap-2">
            <CmxSwitch
              checked={showForCustomer}
              onCheckedChange={setShowForCustomer}
            />
            <label className="text-sm text-gray-700">{t('showForCustomer', { defaultValue: 'Show for Customer' })}</label>
          </div>
          <div className="flex items-center gap-2">
            <CmxSwitch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <label className="text-sm text-gray-700">{t('enabled', { defaultValue: 'Enabled' })}</label>
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton type="button" variant="outline">
                {t('cancel', { defaultValue: 'Cancel' })}
              </CmxButton>
            </CmxDialogClose>
            <CmxButton type="submit" disabled={saving}>
              {saving ? t('saving', { defaultValue: 'Saving...' }) : t('save', { defaultValue: 'Save' })}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}

/**
 * Renders tenant catalog configuration for preference options and bundles.
 *
 * @returns Preferences catalog page.
 */
export default function PreferencesCatalogPage() {
  const t = useTranslations('catalog.preferences');
  const tCatalog = useTranslations('catalog');
  const locale = useLocale();
  const isRtl = useMemo(() => locale === 'ar', [locale]);
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const { bundles } = usePreferenceBundles();
  const [loading, setLoading] = useState(false);
  const [servicePrefs, setServicePrefs] = useState<ServicePref[]>([]);
  const [packingPrefs, setPackingPrefs] = useState<PackingPref[]>([]);
  const [servicePrefsAdmin, setServicePrefsAdmin] = useState<ServicePrefAdmin[]>([]);
  const [packingPrefsAdmin, setPackingPrefsAdmin] = useState<PackingPrefAdmin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bundleDialogOpen, setBundleDialogOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<PreferenceBundle | null>(null);
  const [editingServicePref, setEditingServicePref] = useState<ServicePrefAdmin | null>(null);
  const [editingPackingPref, setEditingPackingPref] = useState<PackingPrefAdmin | null>(null);
  const [createServicePrefOpen, setCreateServicePrefOpen] = useState(false);
  const [createPackingPrefOpen, setCreatePackingPrefOpen] = useState(false);
  const [preferenceKindsAdmin, setPreferenceKindsAdmin] = useState<PreferenceKindAdmin[]>([]);
  const [editingPreferenceKind, setEditingPreferenceKind] = useState<PreferenceKindAdmin | null>(null);
  const { showConfirm } = useAlertDialog();
  const { showSuccess, showError } = useMessage();
  const [serviceOfferFilter, setServiceOfferFilter] = useState<CatalogOfferFilter>('all');
  const [packingOfferFilter, setPackingOfferFilter] = useState<CatalogOfferFilter>('all');
  const [removingServiceCode, setRemovingServiceCode] = useState<string | null>(null);
  const [removingPackingCode, setRemovingPackingCode] = useState<string | null>(null);

  const deleteBundleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/catalog/preference-bundles/${id}`, {
        method: 'DELETE',
        headers: getCSRFHeader(),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to delete');
    },
    onError: (error: unknown) => {
      showError(error instanceof Error ? error.message : t('bundleDeleteError', { defaultValue: 'Could not delete care package' }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preference-bundles'] });
      showSuccess(t('bundleDeletedSuccess', { defaultValue: 'Care package removed' }));
    },
  });

  const loadCatalog = useCallback(() => {
    if (!currentTenant) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/v1/catalog/service-preferences').then((r) => r.json()),
      fetch('/api/v1/catalog/packing-preferences').then((r) => r.json()),
      fetch('/api/v1/catalog/service-preferences/admin', { credentials: 'include' }).then((r) => r.json()).catch(() => ({ success: false })),
      fetch('/api/v1/catalog/packing-preferences/admin', { credentials: 'include' }).then((r) => r.json()).catch(() => ({ success: false })),
      fetch('/api/v1/catalog/preference-kinds/admin', { credentials: 'include' }).then((r) => r.json()).catch(() => ({ success: false })),
    ])
      .then(([svcRes, pckRes, svcAdminRes, pckAdminRes, kindsAdminRes]) => {
        if (!svcRes?.success) throw new Error(svcRes?.error || 'Failed to load service preferences');
        if (!pckRes?.success) throw new Error(pckRes?.error || 'Failed to load packing preferences');
        setServicePrefs(svcRes.data || []);
        setPackingPrefs(pckRes.data || []);
        if (svcAdminRes?.success) setServicePrefsAdmin(svcAdminRes.data || []);
        if (pckAdminRes?.success) setPackingPrefsAdmin(pckAdminRes.data || []);
        if (kindsAdminRes?.success) setPreferenceKindsAdmin(kindsAdminRes.data || []);
      })
      .catch((e) => setError(e.message || 'Failed to load catalog'))
      .finally(() => setLoading(false));
  }, [currentTenant]);

  const removeServicePrefRow = useCallback(
    async (row: ServicePrefAdmin) => {
      if (!row.cf_id) return;
      const ok = await showConfirm({
        title: t('removeFromCatalogTitle', { defaultValue: 'Remove from catalog?' }),
        description: t('removeFromCatalogServiceDesc', { code: row.code }),
        variant: 'destructive',
        confirmLabel: t('removeFromCatalogConfirm', { defaultValue: 'Remove' }),
        cancelLabel: t('cancel', { defaultValue: 'Cancel' }),
      });
      if (!ok) return;
      setRemovingServiceCode(row.code);
      try {
        const res = await fetch(`/api/v1/catalog/service-preferences/${encodeURIComponent(row.code)}`, {
          method: 'DELETE',
          headers: getCSRFHeader(),
        });
        const data = (await res.json()) as { success?: boolean; error?: string | Record<string, unknown> };
        if (!res.ok || !data?.success) {
          const errMsg =
            typeof data?.error === 'string' ? data.error : 'Failed to remove';
          throw new Error(errMsg);
        }
        showSuccess(t('removedFromCatalogSuccess', { defaultValue: 'Preference removed from catalog' }));
        loadCatalog();
      } catch (e) {
        showError(e instanceof Error ? e.message : t('removeFromCatalogError', { defaultValue: 'Could not remove preference' }));
      } finally {
        setRemovingServiceCode(null);
      }
    },
    [showConfirm, showSuccess, showError, t, loadCatalog]
  );

  const removePackingPrefRow = useCallback(
    async (row: PackingPrefAdmin) => {
      if (!row.cf_id) return;
      const ok = await showConfirm({
        title: t('removeFromCatalogTitle', { defaultValue: 'Remove from catalog?' }),
        description: t('removeFromCatalogPackingDesc', { code: row.code }),
        variant: 'destructive',
        confirmLabel: t('removeFromCatalogConfirm', { defaultValue: 'Remove' }),
        cancelLabel: t('cancel', { defaultValue: 'Cancel' }),
      });
      if (!ok) return;
      setRemovingPackingCode(row.code);
      try {
        const res = await fetch(`/api/v1/catalog/packing-preferences/${encodeURIComponent(row.code)}`, {
          method: 'DELETE',
          headers: getCSRFHeader(),
        });
        const data = (await res.json()) as { success?: boolean; error?: string | Record<string, unknown> };
        if (!res.ok || !data?.success) {
          const errMsg =
            typeof data?.error === 'string' ? data.error : 'Failed to remove';
          throw new Error(errMsg);
        }
        showSuccess(t('removedFromCatalogSuccess', { defaultValue: 'Preference removed from catalog' }));
        loadCatalog();
      } catch (e) {
        showError(e instanceof Error ? e.message : t('removeFromCatalogError', { defaultValue: 'Could not remove preference' }));
      } finally {
        setRemovingPackingCode(null);
      }
    },
    [showConfirm, showSuccess, showError, t, loadCatalog]
  );

  useEffect(() => {
    if (!currentTenant) return;
    const timerId = window.setTimeout(() => {
      loadCatalog();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [currentTenant, loadCatalog]);

  const tabs = useMemo(
    () => [
      {
        id: 'service',
        label: t('tabService', { defaultValue: t('servicePrefs', { defaultValue: 'Service Preferences' }) }),
        icon: <Shirt className="h-4 w-4" aria-hidden />,
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-600">
                {t('servicePrefsDesc', { defaultValue: 'Processing options: starch, perfume, delicate, etc.' })}
              </p>
              <RequireAnyPermission
                permissions={CATALOG_PREFERENCES_ACCESS.actions?.editServicePreferences?.requirement?.permissions ?? []}
                fallback={null}
              >
                <CmxButton
                  size="sm"
                  onClick={() => setCreateServicePrefOpen(true)}
                  data-testid="add-service-pref-btn"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('addServicePref', { defaultValue: 'Add Service Preference' })}
                </CmxButton>
              </RequireAnyPermission>
            </div>
            {servicePrefsAdmin.length > 0 ? (
              <p className="text-xs text-gray-500">
                {t('catalogAddRowHint', {
                  defaultValue:
                    'To offer a platform option on new orders, find a â€œNot in catalogâ€ row and use Add to catalog, or switch the filter above to Not in catalog.',
                })}
              </p>
            ) : null}
            {servicePrefsAdmin.length > 0 ? (
              <CatalogOfferFilterBar value={serviceOfferFilter} onChange={setServiceOfferFilter} />
            ) : null}
            <ServicePrefsTable
              servicePrefsAdmin={servicePrefsAdmin}
              servicePrefs={servicePrefs}
              preferenceKindsAdmin={preferenceKindsAdmin}
              loading={loading}
              onEdit={setEditingServicePref}
              onRemove={servicePrefsAdmin.length > 0 ? removeServicePrefRow : undefined}
              offerFilter={serviceOfferFilter}
              removePendingCode={removingServiceCode}
              isRtl={isRtl}
            />
          </div>
        ),
      },
      {
        id: 'packing',
        label: t('tabPacking', { defaultValue: t('packingPrefs', { defaultValue: 'Packing Preferences' }) }),
        icon: <Package className="h-4 w-4" aria-hidden />,
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-600">
                {t('packingPrefsDesc', { defaultValue: 'Assembly options: hang, fold, box, etc.' })}
              </p>
              <RequireAnyPermission
                permissions={CATALOG_PREFERENCES_ACCESS.actions?.editPackingPreferences?.requirement?.permissions ?? []}
                fallback={null}
              >
                <CmxButton
                  size="sm"
                  onClick={() => setCreatePackingPrefOpen(true)}
                  data-testid="add-packing-pref-btn"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('addPackingPref', { defaultValue: 'Add Packing Preference' })}
                </CmxButton>
              </RequireAnyPermission>
            </div>
            {packingPrefsAdmin.length > 0 ? (
              <p className="text-xs text-gray-500">
                {t('catalogAddRowHint', {
                  defaultValue:
                    'To offer a platform option on new orders, find a â€œNot in catalogâ€ row and use Add to catalog, or switch the filter above to Not in catalog.',
                })}
              </p>
            ) : null}
            {packingPrefsAdmin.length > 0 ? (
              <CatalogOfferFilterBar value={packingOfferFilter} onChange={setPackingOfferFilter} />
            ) : null}
            <PackingPrefsTable
              packingPrefsAdmin={packingPrefsAdmin}
              packingPrefs={packingPrefs}
              loading={loading}
              onEdit={setEditingPackingPref}
              onRemove={packingPrefsAdmin.length > 0 ? removePackingPrefRow : undefined}
              offerFilter={packingOfferFilter}
              removePendingCode={removingPackingCode}
              isRtl={isRtl}
            />
          </div>
        ),
      },
      {
        id: 'bundles',
        label: t('tabBundles', { defaultValue: t('bundles', { defaultValue: 'Care Packages' }) }),
        icon: <Gift className="h-4 w-4" aria-hidden />,
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {t('bundlesDesc', { defaultValue: 'Preference bundles for quick apply (Growth+)' })}
              </p>
              <RequireAnyPermission
                permissions={CATALOG_PREFERENCES_ACCESS.actions?.manageBundles.requirement.permissions ?? []}
                fallback={null}
              >
                <CmxButton
                  size="sm"
                  onClick={() => {
                    setEditingBundle(null);
                    setBundleDialogOpen(true);
                  }}
                  data-testid="add-bundle-btn"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('addBundle', { defaultValue: 'Add Bundle' })}
                </CmxButton>
              </RequireAnyPermission>
            </div>
            <BundlesTable
              bundles={bundles}
              loading={loading}
              onEdit={(b) => {
                setEditingBundle(b);
                setBundleDialogOpen(true);
              }}
              onDelete={async (b) => {
                const ok = await showConfirm({
                  title: t('confirmDeleteBundleTitle', { defaultValue: 'Delete care package?' }),
                  description: t('confirmDeleteBundleMessage', { name: b.name, code: b.bundle_code }),
                  variant: 'destructive',
                  confirmLabel: t('delete', { defaultValue: 'Delete' }),
                  cancelLabel: t('cancel', { defaultValue: 'Cancel' }),
                });
                if (!ok) return;
                deleteBundleMutation.mutate(b.id);
              }}
              deletePending={deleteBundleMutation.isPending}
            />
          </div>
        ),
      },
      {
        id: 'kinds',
        label: t('tabKinds', { defaultValue: 'Preference Kinds' }),
        icon: <Layers className="h-4 w-4" aria-hidden />,
        content: (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t('preferenceKindsDesc', { defaultValue: 'Configure which preference tabs show in the order panel' })}
            </p>
            <p className="text-xs text-gray-500">
              {t('preferenceKindsNote', { defaultValue: 'Kind codes are defined by the platform. You can customize labels, colors, and visibility for your tenant.' })}
            </p>
            <PreferenceKindsTable
              kinds={preferenceKindsAdmin}
              loading={loading}
              onEdit={setEditingPreferenceKind}
              isRtl={isRtl}
            />
          </div>
        ),
      },
    ],
    [
      t,
      servicePrefsAdmin,
      servicePrefs,
      packingPrefsAdmin,
      packingPrefs,
      bundles,
      preferenceKindsAdmin,
      loading,
      isRtl,
      deleteBundleMutation,
      serviceOfferFilter,
      packingOfferFilter,
      removingServiceCode,
      removingPackingCode,
      removeServicePrefRow,
      removePackingPrefRow,
      showConfirm,
    ]
  );

  return (
    <RequireAnyPermission
      permissions={CATALOG_PREFERENCES_ACCESS.page.permissions ?? []}
      fallback={
        <CmxCard className="p-6">
          <p className="text-gray-600">You do not have permission to view the preferences catalog.</p>
        </CmxCard>
      }
    >
      <div className="space-y-6" data-testid="preferences-catalog-page">
        {/* Breadcrumb */}
        <nav className="flex items-center text-sm text-gray-500" aria-label="Breadcrumb">
          <Link
            href="/dashboard/catalog/services"
            className="hover:text-gray-700 transition-colors"
          >
            {tCatalog('title', { defaultValue: 'Catalog' })}
          </Link>
          <ChevronRight className="h-4 w-4 mx-1 text-gray-400 rtl:rotate-180" aria-hidden />
          <span className="text-gray-900 font-medium">
            {t('title', { defaultValue: 'Preferences Catalog' })}
          </span>
        </nav>

        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('title', { defaultValue: 'Preferences Catalog' })}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('subtitle', { defaultValue: 'Service and packing preferences for orders' })}
          </p>
        </div>

        {error && (
          <CmxCard className="p-6 border-red-200 bg-red-50">
            <p className="text-red-800">{error}</p>
          </CmxCard>
        )}

        {!error && (
          <CmxCard className="p-6" data-testid="preferences-tabs">
            <CmxTabsPanel tabs={tabs} defaultTab="service" />
          </CmxCard>
        )}

        {bundleDialogOpen && (
          <BundleFormDialog
            bundle={editingBundle}
            servicePrefs={servicePrefs}
            onClose={() => {
              setBundleDialogOpen(false);
              setEditingBundle(null);
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['preference-bundles'] });
              setBundleDialogOpen(false);
              setEditingBundle(null);
            }}
          />
        )}

        {editingServicePref && (
          <ServicePrefEditDialog
            pref={editingServicePref}
            onClose={() => setEditingServicePref(null)}
            onSuccess={() => {
              loadCatalog();
              setEditingServicePref(null);
            }}
          />
        )}

        {editingPackingPref && (
          <PackingPrefEditDialog
            pref={editingPackingPref}
            onClose={() => setEditingPackingPref(null)}
            onSuccess={() => {
              loadCatalog();
              setEditingPackingPref(null);
            }}
          />
        )}

        {createServicePrefOpen && (
          <CustomServicePrefCreateDialog
            onClose={() => setCreateServicePrefOpen(false)}
            onSuccess={() => { loadCatalog(); setCreateServicePrefOpen(false); }}
          />
        )}

        {createPackingPrefOpen && (
          <CustomPackingPrefCreateDialog
            onClose={() => setCreatePackingPrefOpen(false)}
            onSuccess={() => { loadCatalog(); setCreatePackingPrefOpen(false); }}
          />
        )}

        {editingPreferenceKind && (
          <PreferenceKindEditDialog
            kind={editingPreferenceKind}
            onClose={() => setEditingPreferenceKind(null)}
            onSuccess={() => {
              loadCatalog();
              setEditingPreferenceKind(null);
            }}
          />
        )}
      </div>
    </RequireAnyPermission>
  );
}

function BundleFormDialog({
  bundle,
  servicePrefs,
  onClose,
  onSuccess,
}: {
  bundle: PreferenceBundle | null;
  servicePrefs: ServicePref[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations('catalog.preferences');
  const [bundleCode, setBundleCode] = useState(bundle?.bundle_code ?? '');
  const [name, setName] = useState(bundle?.name ?? '');
  const [preferenceCodes, setPreferenceCodes] = useState<string[]>(bundle?.preference_codes ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const url = bundle
        ? `/api/v1/catalog/preference-bundles/${bundle.id}`
        : '/api/v1/catalog/preference-bundles';
      const method = bundle ? 'PATCH' : 'POST';
      const body = bundle
        ? { bundle_code: bundleCode, name, preference_codes: preferenceCodes }
        : { bundle_code: bundleCode, name, preference_codes: preferenceCodes };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to save');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const togglePref = (code: string) => {
    setPreferenceCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  return (
    <CmxDialog open onOpenChange={(open) => !open && onClose()}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>
            {bundle ? t('editBundle', { defaultValue: 'Edit Bundle' }) : t('addBundle', { defaultValue: 'Add Bundle' })}
          </CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('bundleCode', { defaultValue: 'Bundle Code' })}</label>
            <CmxInput
              value={bundleCode}
              onChange={(e) => setBundleCode(e.target.value)}
              placeholder="e.g. DELICATE_STARCH"
              required
              disabled={!!bundle}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('bundleName', { defaultValue: 'Name' })}</label>
            <CmxInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Delicate + Light Starch"
              required
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('preferences', { defaultValue: 'Preferences' })}</label>
            <div className="flex flex-wrap gap-2">
              {servicePrefs.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => togglePref(p.code)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    preferenceCodes.includes(p.code)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton type="button" variant="outline">
                {t('cancel', { defaultValue: 'Cancel' })}
              </CmxButton>
            </CmxDialogClose>
            <CmxButton type="submit" disabled={saving}>
              {saving ? t('saving', { defaultValue: 'Saving...' }) : t('save', { defaultValue: 'Save' })}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}

function CustomServicePrefCreateDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations('catalog.preferences');
  const tv = useTranslations('validation');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [name2, setName2] = useState('');
  const [prefCategory, setPrefCategory] = useState<string>(PREFERENCE_CATEGORIES.PROCESSING);
  const [extraPrice, setExtraPrice] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categorySelectOptions = useMemo(() => {
    return [...ORG_SERVICE_PREFERENCE_CATEGORY_OPTIONS].sort().map((v) => ({
      value: v,
      label: t(`prefCategory.${v}` as 'prefCategory.processing', {
        defaultValue: v.replace(/_/g, ' '),
      }),
    }));
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]*$/.test(trimmed)) {
      setError(tv('invalidFormat', { defaultValue: 'Invalid format' }));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/catalog/service-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader() },
        body: JSON.stringify({
          code: trimmed,
          name: name.trim(),
          name2: name2.trim() || null,
          preference_category: prefCategory || null,
          extra_price: Number(extraPrice) || 0,
          is_active: isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        const msg =
          typeof data?.error === 'string'
            ? data.error
            : data?.error
              ? JSON.stringify(data.error)
              : 'Failed to create';
        throw new Error(msg);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CmxDialog open onOpenChange={(open) => !open && onClose()}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>
            {t('createCustomServicePref', { defaultValue: 'Create custom service preference' })}
          </CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('code', { defaultValue: 'Code' })} <span className="text-red-500">*</span>
            </label>
            <CmxInput
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CUSTOM_PREF"
              className="w-full font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('customName', { defaultValue: 'Name (EN)' })} <span className="text-red-500">*</span>
            </label>
            <CmxInput value={name} onChange={(e) => setName(e.target.value)} className="w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('customNameAr', { defaultValue: 'Name (AR)' })}
            </label>
            <CmxInput value={name2} onChange={(e) => setName2(e.target.value)} className="w-full" />
          </div>
          <div>
            <CmxSelect
              label={t('category', { defaultValue: 'Category' })}
              options={categorySelectOptions}
              value={prefCategory}
              onChange={(e) => setPrefCategory(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('extraPrice', { defaultValue: 'Extra Price' })}
            </label>
            <CmxInput
              type="number"
              step="0.0001"
              value={extraPrice}
              onChange={(e) => setExtraPrice(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <CmxSwitch checked={isActive} onCheckedChange={setIsActive} id="svc-create-active" />
            <label htmlFor="svc-create-active" className="text-sm text-gray-700">
              {t('active', { defaultValue: 'Active' })}
            </label>
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton type="button" variant="outline">
                {t('cancel', { defaultValue: 'Cancel' })}
              </CmxButton>
            </CmxDialogClose>
            <CmxButton type="submit" disabled={saving}>
              {saving ? t('saving', { defaultValue: 'Saving...' }) : t('create', { defaultValue: 'Create' })}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}

function CustomPackingPrefCreateDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations('catalog.preferences');
  const tv = useTranslations('validation');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [name2, setName2] = useState('');
  const [extraPrice, setExtraPrice] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]*$/.test(trimmed)) {
      setError(tv('invalidFormat', { defaultValue: 'Invalid format' }));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/catalog/packing-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader() },
        body: JSON.stringify({
          code: trimmed,
          name: name.trim(),
          name2: name2.trim() || null,
          extra_price: Number(extraPrice) || 0,
          is_active: isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        const msg =
          typeof data?.error === 'string'
            ? data.error
            : data?.error
              ? JSON.stringify(data.error)
              : 'Failed to create';
        throw new Error(msg);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CmxDialog open onOpenChange={(open) => !open && onClose()}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>
            {t('createCustomPackingPref', { defaultValue: 'Create custom packing preference' })}
          </CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('code', { defaultValue: 'Code' })} <span className="text-red-500">*</span>
            </label>
            <CmxInput
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CUSTOM_PACK"
              className="w-full font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('customName', { defaultValue: 'Name (EN)' })} <span className="text-red-500">*</span>
            </label>
            <CmxInput value={name} onChange={(e) => setName(e.target.value)} className="w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('customNameAr', { defaultValue: 'Name (AR)' })}
            </label>
            <CmxInput value={name2} onChange={(e) => setName2(e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('extraPrice', { defaultValue: 'Extra Price' })}
            </label>
            <CmxInput
              type="number"
              step="0.0001"
              value={extraPrice}
              onChange={(e) => setExtraPrice(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <CmxSwitch checked={isActive} onCheckedChange={setIsActive} id="pack-create-active" />
            <label htmlFor="pack-create-active" className="text-sm text-gray-700">
              {t('active', { defaultValue: 'Active' })}
            </label>
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton type="button" variant="outline">
                {t('cancel', { defaultValue: 'Cancel' })}
              </CmxButton>
            </CmxDialogClose>
            <CmxButton type="submit" disabled={saving}>
              {saving ? t('saving', { defaultValue: 'Saving...' }) : t('create', { defaultValue: 'Create' })}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}

function ServicePrefEditDialog({
  pref,
  onClose,
  onSuccess,
}: {
  pref: ServicePrefAdmin;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations('catalog.preferences');
  const tv = useTranslations('validation');
  const { showConfirm } = useAlertDialog();
  const editsColorSwatch = isColorPreferenceGroupOrRow(pref);
  const [name, setName] = useState(pref.cf_name ?? pref.name ?? '');
  const [name2, setName2] = useState(pref.cf_name2 ?? pref.name2 ?? '');
  const [prefCategory, setPrefCategory] = useState(
    () => pref.preference_category || PREFERENCE_CATEGORIES.PROCESSING
  );
  const [extraPrice, setExtraPrice] = useState(String(pref.cf_extra_price ?? pref.default_extra_price ?? 0));
  const [isIncludedInBase, setIsIncludedInBase] = useState(pref.cf_is_included_in_base ?? false);
  const [isActive, setIsActive] = useState(pref.cf_is_active ?? true);
  const [colorHex, setColorHex] = useState(pref.cf_color_hex ?? pref.color_hex ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categorySelectOptions = useMemo(() => {
    const values = new Set<string>([...ORG_SERVICE_PREFERENCE_CATEGORY_OPTIONS]);
    const cur = pref.preference_category;
    if (cur) values.add(cur);
    return [...values]
      .sort()
      .map((v) => ({
        value: v,
        label: t(`prefCategory.${v}` as 'prefCategory.processing', {
          defaultValue: v.replace(/_/g, ' '),
        }),
      }));
  }, [pref.preference_category, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      let color_hex: string | null | undefined;
      if (editsColorSwatch) {
        const nh = normalizeHexDraftForApi(colorHex);
        if (nh === 'invalid') {
          setError(tv('invalidFormat', { defaultValue: 'Invalid format' }));
          return;
        }
        color_hex = nh;
      }

      const res = await fetch(`/api/v1/catalog/service-preferences/${encodeURIComponent(pref.code)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader() },
        body: JSON.stringify({
          name: name || null,
          name2: name2 || null,
          extra_price: Number(extraPrice) || 0,
          is_included_in_base: isIncludedInBase,
          is_active: isActive,
          preference_category: prefCategory || null,
          ...(editsColorSwatch ? { color_hex } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to save');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromCatalog = async () => {
    if (!pref.cf_id) return;
    const ok = await showConfirm({
      title: t('removeFromCatalogTitle', { defaultValue: 'Remove from catalog?' }),
      description: t('removeFromCatalogServiceDesc', { code: pref.code }),
      variant: 'destructive',
      confirmLabel: t('removeFromCatalogConfirm', { defaultValue: 'Remove' }),
      cancelLabel: t('cancel', { defaultValue: 'Cancel' }),
    });
    if (!ok) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/catalog/service-preferences/${encodeURIComponent(pref.code)}`, {
        method: 'DELETE',
        headers: getCSRFHeader(),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to remove');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CmxDialog open onOpenChange={(open) => !open && onClose()}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>
            {pref.cf_id
              ? t('editServicePref', { defaultValue: 'Edit Service Preference' })
              : t('addServicePref', { defaultValue: 'Add Service Preference' })}
          </CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">{error}</div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 font-mono">{pref.code}</span>
            {pref.preference_sys_kind && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                {pref.preference_sys_kind}
              </span>
            )}
          </div>
          {!pref.cf_id ? (
            <p className="text-sm rounded-md bg-sky-50 text-sky-900 px-3 py-2 border border-sky-100">
              {t('enablePreferenceHint', {
                defaultValue:
                  'Saving adds this platform option to your tenant catalog so it appears on new orders.',
              })}
            </p>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('customName', { defaultValue: 'Custom Name (EN)' })}</label>
            <CmxInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={pref.name ?? pref.code}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('customNameAr', { defaultValue: 'Custom Name (AR)' })}</label>
            <CmxInput
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              placeholder={pref.name2 ?? ''}
              className="w-full"
            />
          </div>
          <div>
            <CmxSelect
              label={t('category', { defaultValue: 'Category' })}
              options={categorySelectOptions}
              value={prefCategory}
              onChange={(e) => setPrefCategory(e.target.value)}
            />
          </div>
          {editsColorSwatch ? (
            <CmxHexColorField
              label={t('preferenceColor', { defaultValue: 'Garment swatch color' })}
              helperText={t('preferenceColorHint', {
                defaultValue: '#RRGGBB or blank to use catalog default',
              })}
              hexPlaceholder={t('preferenceColorPlaceholder', { defaultValue: '#1976D2' })}
              pickerAriaLabel={t('colorPickLabel', { defaultValue: 'Open color picker' })}
              clearLabel={t('clearPreferenceColor', { defaultValue: 'Use catalog default' })}
              invalidMessage={tv('invalidFormat', { defaultValue: 'Invalid format' })}
              value={colorHex}
              onChange={setColorHex}
            />
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('extraPrice', { defaultValue: 'Extra Price' })}</label>
            <CmxInput
              type="number"
              step="0.0001"
              min="0"
              value={extraPrice}
              onChange={(e) => setExtraPrice(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <CmxSwitch
              checked={isIncludedInBase}
              onCheckedChange={setIsIncludedInBase}
            />
            <label className="text-sm text-gray-700">{t('includedInBase', { defaultValue: 'Included in base price' })}</label>
          </div>
          <div className="flex items-center gap-2">
            <CmxSwitch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <label className="text-sm text-gray-700">{t('enabled', { defaultValue: 'Enabled' })}</label>
          </div>
          <CmxDialogFooter>
            {pref.cf_id && (
              <CmxButton
                type="button"
                variant="outline"
                onClick={() => void handleRemoveFromCatalog()}
                disabled={saving}
                className="mr-auto text-red-700 border-red-200 hover:bg-red-50"
              >
                {t('removeFromCatalog', { defaultValue: 'Remove from catalog' })}
              </CmxButton>
            )}
            <CmxDialogClose asChild>
              <CmxButton type="button" variant="outline">
                {t('cancel', { defaultValue: 'Cancel' })}
              </CmxButton>
            </CmxDialogClose>
            <CmxButton type="submit" disabled={saving}>
              {saving
                ? t('saving', { defaultValue: 'Saving...' })
                : pref.cf_id
                  ? t('save', { defaultValue: 'Save' })
                  : t('saveAddToCatalog', { defaultValue: 'Add to catalog' })}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}

function PackingPrefEditDialog({
  pref,
  onClose,
  onSuccess,
}: {
  pref: PackingPrefAdmin;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations('catalog.preferences');
  const { showConfirm } = useAlertDialog();
  const [name, setName] = useState(pref.cf_name ?? pref.name ?? '');
  const [name2, setName2] = useState(pref.cf_name2 ?? pref.name2 ?? '');
  const [extraPrice, setExtraPrice] = useState(String(pref.cf_extra_price ?? 0));
  const [isActive, setIsActive] = useState(pref.cf_is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/catalog/packing-preferences/${encodeURIComponent(pref.code)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader() },
        body: JSON.stringify({
          name: name || null,
          name2: name2 || null,
          extra_price: Number(extraPrice) || 0,
          is_active: isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to save');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromCatalog = async () => {
    if (!pref.cf_id) return;
    const ok = await showConfirm({
      title: t('removeFromCatalogTitle', { defaultValue: 'Remove from catalog?' }),
      description: t('removeFromCatalogPackingDesc', { code: pref.code }),
      variant: 'destructive',
      confirmLabel: t('removeFromCatalogConfirm', { defaultValue: 'Remove' }),
      cancelLabel: t('cancel', { defaultValue: 'Cancel' }),
    });
    if (!ok) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/catalog/packing-preferences/${encodeURIComponent(pref.code)}`, {
        method: 'DELETE',
        headers: getCSRFHeader(),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to remove');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CmxDialog open onOpenChange={(open) => !open && onClose()}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>
            {pref.cf_id
              ? t('editPackingPref', { defaultValue: 'Edit Packing Preference' })
              : t('addPackingPref', { defaultValue: 'Add Packing Preference' })}
          </CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">{error}</div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 font-mono">{pref.code}</span>
            {pref.maps_to_packaging_type ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200">
                {pref.maps_to_packaging_type}
              </span>
            ) : null}
          </div>
          {!pref.cf_id ? (
            <p className="text-sm rounded-md bg-sky-50 text-sky-900 px-3 py-2 border border-sky-100">
              {t('enablePreferenceHint', {
                defaultValue:
                  'Saving adds this platform option to your tenant catalog so it appears on new orders.',
              })}
            </p>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('customName', { defaultValue: 'Custom Name (EN)' })}</label>
            <CmxInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={pref.name ?? pref.code}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('customNameAr', { defaultValue: 'Custom Name (AR)' })}</label>
            <CmxInput
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              placeholder={pref.name2 ?? ''}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('extraPrice', { defaultValue: 'Extra Price' })}</label>
            <CmxInput
              type="number"
              step="0.0001"
              min="0"
              value={extraPrice}
              onChange={(e) => setExtraPrice(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <CmxSwitch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <label className="text-sm text-gray-700">{t('enabled', { defaultValue: 'Enabled' })}</label>
          </div>
          <CmxDialogFooter>
            {pref.cf_id && (
              <CmxButton
                type="button"
                variant="outline"
                onClick={() => void handleRemoveFromCatalog()}
                disabled={saving}
                className="mr-auto text-red-700 border-red-200 hover:bg-red-50"
              >
                {t('removeFromCatalog', { defaultValue: 'Remove from catalog' })}
              </CmxButton>
            )}
            <CmxDialogClose asChild>
              <CmxButton type="button" variant="outline">
                {t('cancel', { defaultValue: 'Cancel' })}
              </CmxButton>
            </CmxDialogClose>
            <CmxButton type="submit" disabled={saving}>
              {saving
                ? t('saving', { defaultValue: 'Saving...' })
                : pref.cf_id
                  ? t('save', { defaultValue: 'Save' })
                  : t('saveAddToCatalog', { defaultValue: 'Add to catalog' })}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
