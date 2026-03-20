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
import { usePreferenceBundles } from '@/src/features/orders/hooks/use-preference-bundles';
import { CmxCard } from '@ui/primitives/cmx-card';
import { CmxButton, CmxInput, CmxSwitch } from '@ui/primitives';
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

interface ServicePref {
  code: string;
  name: string;
  name2?: string | null;
  preference_category?: string;
  default_extra_price?: number;
  extra_turnaround_minutes?: number;
  is_active?: boolean;
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
  default_extra_price: number;
  display_order: number;
  sys_is_active: boolean;
  cf_id: string | null;
  cf_name: string | null;
  cf_name2: string | null;
  cf_extra_price: number | null;
  cf_is_included_in_base: boolean | null;
  cf_is_active: boolean | null;
  cf_display_order: number | null;
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

function ServicePrefsTable({
  servicePrefsAdmin,
  servicePrefs,
  loading,
  onEdit,
  t,
  isRtl,
}: {
  servicePrefsAdmin: ServicePrefAdmin[];
  servicePrefs: ServicePref[];
  loading: boolean;
  onEdit: (p: ServicePrefAdmin) => void;
  t: (key: string, fallback?: string) => string;
  isRtl: boolean;
}) {
  const rows = servicePrefsAdmin.length > 0 ? servicePrefsAdmin : servicePrefs;
  const isAdmin = servicePrefsAdmin.length > 0;

  if (loading) {
    return <TableSkeleton rows={6} />;
  }

  if (rows.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center text-gray-500"
        data-testid="service-prefs-empty"
      >
        <Shirt className="h-12 w-12 text-gray-300 mb-3" aria-hidden />
        <p className="text-sm font-medium">{t('noServicePrefs', 'No service preferences configured')}</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]"
      data-testid="service-prefs-table"
    >
      <table className="min-w-full text-sm">
        <thead className="bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
          <tr>
            <th className="px-4 py-3 text-left font-medium">{t('code', 'Code')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('name', 'Name')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('nameAr', 'Name (AR)')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('category', 'Category')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('extraPrice', 'Extra Price')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('status', 'Status')}</th>
            {isAdmin && (
              <th className="px-4 py-3 text-right font-medium">{t('actions', 'Actions')}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const adminRow = isAdmin ? (p as ServicePrefAdmin) : null;
            const displayName = adminRow ? (adminRow.cf_name ?? adminRow.name) : (p as ServicePref).name;
            const displayName2 = adminRow ? (adminRow.cf_name2 ?? adminRow.name2) : (p as ServicePref).name2;
            const primaryName = isRtl ? (displayName2 ?? displayName) : displayName;
            const displayPrice = adminRow ? (adminRow.cf_extra_price ?? adminRow.default_extra_price) : ((p as ServicePref).default_extra_price ?? 0);
            const isActive = adminRow ? adminRow.cf_is_active !== false : true;
            const category = adminRow?.preference_category ?? (p as ServicePref).preference_category ?? '—';

            return (
              <tr key={p.code} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                <td className="px-4 py-3">{primaryName || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{displayName2 || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{category}</td>
                <td className="px-4 py-3">+{Number(displayPrice).toFixed(3)}</td>
                <td className="px-4 py-3">
                  <Badge variant={isActive ? 'success' : 'default'}>
                    {isActive ? t('active', 'Active') : t('inactive', 'Inactive')}
                  </Badge>
                </td>
                {isAdmin && adminRow && (
                  <td className="px-4 py-3 text-right">
                    <RequireAnyPermission permissions={['config:preferences_manage']} fallback={null}>
                      <CmxButton
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => onEdit(adminRow)}
                        aria-label={t('edit', 'Edit')}
                        data-testid={`edit-service-pref-${p.code}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </CmxButton>
                    </RequireAnyPermission>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PackingPrefsTable({
  packingPrefsAdmin,
  packingPrefs,
  loading,
  onEdit,
  t,
  isRtl,
}: {
  packingPrefsAdmin: PackingPrefAdmin[];
  packingPrefs: PackingPref[];
  loading: boolean;
  onEdit: (p: PackingPrefAdmin) => void;
  t: (key: string, fallback?: string) => string;
  isRtl: boolean;
}) {
  const rows = packingPrefsAdmin.length > 0 ? packingPrefsAdmin : packingPrefs;
  const isAdmin = packingPrefsAdmin.length > 0;

  if (loading) {
    return <TableSkeleton rows={6} />;
  }

  if (rows.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center text-gray-500"
        data-testid="packing-prefs-empty"
      >
        <Package className="h-12 w-12 text-gray-300 mb-3" aria-hidden />
        <p className="text-sm font-medium">{t('noPackingPrefs', 'No packing preferences configured')}</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]"
      data-testid="packing-prefs-table"
    >
      <table className="min-w-full text-sm">
        <thead className="bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
          <tr>
            <th className="px-4 py-3 text-left font-medium">{t('code', 'Code')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('name', 'Name')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('nameAr', 'Name (AR)')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('packagingType', 'Packaging Type')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('status', 'Status')}</th>
            {isAdmin && (
              <th className="px-4 py-3 text-right font-medium">{t('actions', 'Actions')}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const adminRow = isAdmin ? (p as PackingPrefAdmin) : null;
            const displayName = adminRow ? (adminRow.cf_name ?? adminRow.name) : (p as PackingPref).name;
            const displayName2 = adminRow ? (adminRow.cf_name2 ?? adminRow.name2) : (p as PackingPref).name2;
            const primaryName = isRtl ? (displayName2 ?? displayName) : displayName;
            const isActive = adminRow ? adminRow.cf_is_active !== false : true;
            const packagingType = adminRow?.maps_to_packaging_type ?? (p as PackingPref).maps_to_packaging_type ?? '—';

            return (
              <tr key={p.code} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                <td className="px-4 py-3">{primaryName || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{displayName2 || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{packagingType}</td>
                <td className="px-4 py-3">
                  <Badge variant={isActive ? 'success' : 'default'}>
                    {isActive ? t('active', 'Active') : t('inactive', 'Inactive')}
                  </Badge>
                </td>
                {isAdmin && adminRow && (
                  <td className="px-4 py-3 text-right">
                    <RequireAnyPermission permissions={['config:preferences_manage']} fallback={null}>
                      <CmxButton
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => onEdit(adminRow)}
                        aria-label={t('edit', 'Edit')}
                        data-testid={`edit-packing-pref-${p.code}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </CmxButton>
                    </RequireAnyPermission>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BundlesTable({
  bundles,
  loading,
  onEdit,
  onDelete,
  t,
  deletePending,
}: {
  bundles: PreferenceBundle[];
  loading: boolean;
  onEdit: (b: PreferenceBundle) => void;
  onDelete: (b: PreferenceBundle) => void;
  t: (key: string, fallback?: string) => string;
  deletePending: boolean;
}) {
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
        <p className="text-sm font-medium">{t('noBundles', 'No care packages configured')}</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]"
      data-testid="bundles-table"
    >
      <table className="min-w-full text-sm">
        <thead className="bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
          <tr>
            <th className="px-4 py-3 text-left font-medium">{t('bundleCode', 'Code')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('bundleName', 'Name')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('preferences', 'Preferences')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('discount', 'Discount')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('status', 'Status')}</th>
            <RequireAnyPermission permissions={['config:preferences_manage']} fallback={<th />}>
              <th className="px-4 py-3 text-right font-medium">{t('actions', 'Actions')}</th>
            </RequireAnyPermission>
          </tr>
        </thead>
        <tbody>
          {bundles.map((b) => (
            <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50/50">
              <td className="px-4 py-3 font-mono text-xs">{b.bundle_code}</td>
              <td className="px-4 py-3">{b.name}</td>
              <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={(b.preference_codes || []).join(', ')}>
                {(b.preference_codes || []).join(', ') || '—'}
              </td>
              <td className="px-4 py-3">
                {(b.discount_percent ?? 0) > 0
                  ? `${b.discount_percent}%`
                  : (b.discount_amount ?? 0) > 0
                    ? `${Number(b.discount_amount).toFixed(3)}`
                    : '—'}
              </td>
              <td className="px-4 py-3">
                <Badge variant={b.is_active ? 'success' : 'default'}>
                  {b.is_active ? t('active', 'Active') : t('inactive', 'Inactive')}
                </Badge>
              </td>
              <RequireAnyPermission permissions={['config:preferences_manage']} fallback={<td />}>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <CmxButton
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => onEdit(b)}
                      aria-label={t('edit', 'Edit')}
                      data-testid={`edit-bundle-${b.bundle_code}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </CmxButton>
                    <CmxButton
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-red-600 hover:text-red-700"
                      onClick={() => onDelete(b)}
                      disabled={deletePending}
                      aria-label={t('delete', 'Delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </CmxButton>
                  </div>
                </td>
              </RequireAnyPermission>
            </tr>
          ))}
        </tbody>
      </table>
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

function PreferenceKindsTable({
  kinds,
  loading,
  onEdit,
  t,
  isRtl,
}: {
  kinds: PreferenceKindAdmin[];
  loading: boolean;
  onEdit: (k: PreferenceKindAdmin) => void;
  t: (key: string, fallback?: string) => string;
  isRtl: boolean;
}) {
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
        <p className="text-sm font-medium">{t('noPreferenceKinds', 'No preference kinds configured')}</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]"
      data-testid="preference-kinds-table"
    >
      <table className="min-w-full text-sm">
        <thead className="bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
          <tr>
            <th className="px-4 py-3 text-left font-medium">{t('kindCode', 'Kind Code')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('name', 'Name')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('nameAr', 'Name (AR)')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('mainType', 'Main Type')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('bgColor', 'BG Color')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('showInQuickBar', 'Quick Bar')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('showForCustomer', 'Customer')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('status', 'Status')}</th>
            <th className="px-4 py-3 text-right font-medium">{t('actions', 'Actions')}</th>
          </tr>
        </thead>
        <tbody>
          {kinds.map((k) => {
            const displayName = k.cf_name ?? k.name;
            const displayName2 = k.cf_name2 ?? k.name2;
            const primaryName = isRtl ? (displayName2 ?? displayName) : displayName;
            const isActive = k.cf_is_active !== false;
            const bgColor = k.cf_kind_bg_color ?? k.kind_bg_color;
            const showQuickBar = k.cf_is_show_in_quick_bar ?? false;
            const showForCustomer = k.cf_is_show_for_customer ?? false;

            return (
              <tr key={k.kind_code} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-mono text-xs">{k.kind_code}</td>
                <td className="px-4 py-3">{primaryName || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{displayName2 || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{k.main_type_code || '—'}</td>
                <td className="px-4 py-3">
                  {bgColor ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: bgColor }}
                        aria-hidden="true"
                      />
                      <span className="font-mono text-xs text-gray-600">{bgColor}</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={showQuickBar ? 'success' : 'default'}>
                    {showQuickBar ? t('yes', 'Yes') : t('no', 'No')}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={showForCustomer ? 'success' : 'default'}>
                    {showForCustomer ? t('yes', 'Yes') : t('no', 'No')}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={isActive ? 'success' : 'default'}>
                    {isActive ? t('active', 'Active') : t('inactive', 'Inactive')}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <RequireAnyPermission permissions={['config:preferences_manage']} fallback={null}>
                    <CmxButton
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => onEdit(k)}
                      aria-label={t('edit', 'Edit')}
                      data-testid={`edit-preference-kind-${k.kind_code}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </CmxButton>
                  </RequireAnyPermission>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
      const res = await fetch('/api/v1/catalog/preference-kinds/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader() },
        body: JSON.stringify({
          kindCode: kind.kind_code,
          name: name || null,
          name2: name2 || null,
          kind_bg_color: bgColor || null,
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
          <CmxDialogTitle>{t('editPreferenceKind', 'Edit Preference Kind')}</CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">{error}</div>
          )}
          <p className="text-sm text-gray-600 font-mono">{kind.kind_code}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('customName', 'Custom Name (EN)')}</label>
            <CmxInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind.name ?? kind.kind_code}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('customNameAr', 'Custom Name (AR)')}</label>
            <CmxInput
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              placeholder={kind.name2 ?? ''}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('bgColor', 'Background Color')}</label>
            <CmxInput
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              placeholder="#6366f1"
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <CmxSwitch
              checked={showInQuickBar}
              onCheckedChange={setShowInQuickBar}
            />
            <label className="text-sm text-gray-700">{t('showInQuickBar', 'Show in Quick Bar')}</label>
          </div>
          <div className="flex items-center gap-2">
            <CmxSwitch
              checked={showForCustomer}
              onCheckedChange={setShowForCustomer}
            />
            <label className="text-sm text-gray-700">{t('showForCustomer', 'Show for Customer')}</label>
          </div>
          <div className="flex items-center gap-2">
            <CmxSwitch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <label className="text-sm text-gray-700">{t('enabled', 'Enabled')}</label>
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton type="button" variant="outline">
                {t('cancel', 'Cancel')}
              </CmxButton>
            </CmxDialogClose>
            <CmxButton type="submit" disabled={saving}>
              {saving ? t('saving', 'Saving...') : t('save', 'Save')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}

export default function PreferencesCatalogPage() {
  const t = useTranslations('catalog.preferences');
  const tCatalog = useTranslations('catalog');
  const locale = useLocale();
  const isRtl = useMemo(() => locale === 'ar', [locale]);
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const { bundles } = usePreferenceBundles();
  const [loading, setLoading] = useState(true);
  const [servicePrefs, setServicePrefs] = useState<ServicePref[]>([]);
  const [packingPrefs, setPackingPrefs] = useState<PackingPref[]>([]);
  const [servicePrefsAdmin, setServicePrefsAdmin] = useState<ServicePrefAdmin[]>([]);
  const [packingPrefsAdmin, setPackingPrefsAdmin] = useState<PackingPrefAdmin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bundleDialogOpen, setBundleDialogOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<PreferenceBundle | null>(null);
  const [editingServicePref, setEditingServicePref] = useState<ServicePrefAdmin | null>(null);
  const [editingPackingPref, setEditingPackingPref] = useState<PackingPrefAdmin | null>(null);
  const [preferenceKindsAdmin, setPreferenceKindsAdmin] = useState<PreferenceKindAdmin[]>([]);
  const [editingPreferenceKind, setEditingPreferenceKind] = useState<PreferenceKindAdmin | null>(null);

  const deleteBundleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/catalog/preference-bundles/${id}`, {
        method: 'DELETE',
        headers: getCSRFHeader(),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preference-bundles'] });
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

  useEffect(() => {
    if (!currentTenant) {
      setLoading(false);
      return;
    }
    loadCatalog();
  }, [currentTenant, loadCatalog]);

  const tabs = useMemo(
    () => [
      {
        id: 'service',
        label: t('tabService', { defaultValue: t('servicePrefs', 'Service Preferences') }),
        icon: <Shirt className="h-4 w-4" aria-hidden />,
        content: (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t('servicePrefsDesc', 'Processing options: starch, perfume, delicate, etc.')}
            </p>
            <ServicePrefsTable
              servicePrefsAdmin={servicePrefsAdmin}
              servicePrefs={servicePrefs}
              loading={loading}
              onEdit={setEditingServicePref}
              t={(k, f) => t(k as 'code', { defaultValue: f })}
              isRtl={isRtl}
            />
          </div>
        ),
      },
      {
        id: 'packing',
        label: t('tabPacking', { defaultValue: t('packingPrefs', 'Packing Preferences') }),
        icon: <Package className="h-4 w-4" aria-hidden />,
        content: (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t('packingPrefsDesc', 'Assembly options: hang, fold, box, etc.')}
            </p>
            <PackingPrefsTable
              packingPrefsAdmin={packingPrefsAdmin}
              packingPrefs={packingPrefs}
              loading={loading}
              onEdit={setEditingPackingPref}
              t={(k, f) => t(k as 'code', { defaultValue: f })}
              isRtl={isRtl}
            />
          </div>
        ),
      },
      {
        id: 'bundles',
        label: t('tabBundles', { defaultValue: t('bundles', 'Care Packages') }),
        icon: <Gift className="h-4 w-4" aria-hidden />,
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {t('bundlesDesc', 'Preference bundles for quick apply (Growth+)')}
              </p>
              <RequireAnyPermission permissions={['config:preferences_manage']} fallback={null}>
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
              onDelete={(b) => {
                if (confirm(t('confirmDeleteBundle', 'Delete this bundle?'))) {
                  deleteBundleMutation.mutate(b.id);
                }
              }}
              t={(k, f) => t(k as 'bundleCode', { defaultValue: f })}
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
              {t('preferenceKindsDesc', 'Configure which preference tabs show in the order panel')}
            </p>
            <PreferenceKindsTable
              kinds={preferenceKindsAdmin}
              loading={loading}
              onEdit={setEditingPreferenceKind}
              t={(k, f) => t(k as 'kindCode', { defaultValue: f })}
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
      deleteBundleMutation.isPending,
    ]
  );

  return (
    <RequireAnyPermission
      permissions={['orders:service_prefs_view', 'orders:read', 'config:preferences_manage']}
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
            {bundle ? t('editBundle', 'Edit Bundle') : t('addBundle', 'Add Bundle')}
          </CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('bundleCode', 'Bundle Code')}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('bundleName', 'Name')}</label>
            <CmxInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Delicate + Light Starch"
              required
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('preferences', 'Preferences')}</label>
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
                {t('cancel', 'Cancel')}
              </CmxButton>
            </CmxDialogClose>
            <CmxButton type="submit" disabled={saving}>
              {saving ? t('saving', 'Saving...') : t('save', 'Save')}
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
  const [name, setName] = useState(pref.cf_name ?? pref.name ?? '');
  const [name2, setName2] = useState(pref.cf_name2 ?? pref.name2 ?? '');
  const [extraPrice, setExtraPrice] = useState(String(pref.cf_extra_price ?? pref.default_extra_price ?? 0));
  const [isIncludedInBase, setIsIncludedInBase] = useState(pref.cf_is_included_in_base ?? false);
  const [isActive, setIsActive] = useState(pref.cf_is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/catalog/service-preferences/${encodeURIComponent(pref.code)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader() },
        body: JSON.stringify({
          name: name || null,
          name2: name2 || null,
          extra_price: Number(extraPrice) || 0,
          is_included_in_base: isIncludedInBase,
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

  const handleReset = async () => {
    if (!pref.cf_id) return;
    if (!confirm(t('resetToDefault', 'Reset to default?'))) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/catalog/service-preferences/${encodeURIComponent(pref.code)}`, {
        method: 'DELETE',
        headers: getCSRFHeader(),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to reset');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CmxDialog open onOpenChange={(open) => !open && onClose()}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('editServicePref', 'Edit Service Preference')}</CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">{error}</div>
          )}
          <p className="text-sm text-gray-600 font-mono">{pref.code}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('customName', 'Custom Name (EN)')}</label>
            <CmxInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={pref.name ?? pref.code}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('customNameAr', 'Custom Name (AR)')}</label>
            <CmxInput
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              placeholder={pref.name2 ?? ''}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('extraPrice', 'Extra Price')}</label>
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
            <label className="text-sm text-gray-700">{t('includedInBase', 'Included in base price')}</label>
          </div>
          <div className="flex items-center gap-2">
            <CmxSwitch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <label className="text-sm text-gray-700">{t('enabled', 'Enabled')}</label>
          </div>
          <CmxDialogFooter>
            {pref.cf_id && (
              <CmxButton type="button" variant="outline" onClick={handleReset} disabled={saving} className="mr-auto">
                {t('resetToDefault', 'Reset to default')}
              </CmxButton>
            )}
            <CmxDialogClose asChild>
              <CmxButton type="button" variant="outline">
                {t('cancel', 'Cancel')}
              </CmxButton>
            </CmxDialogClose>
            <CmxButton type="submit" disabled={saving}>
              {saving ? t('saving', 'Saving...') : t('save', 'Save')}
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

  const handleReset = async () => {
    if (!pref.cf_id) return;
    if (!confirm(t('resetToDefault', 'Reset to default?'))) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/catalog/packing-preferences/${encodeURIComponent(pref.code)}`, {
        method: 'DELETE',
        headers: getCSRFHeader(),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to reset');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CmxDialog open onOpenChange={(open) => !open && onClose()}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('editPackingPref', 'Edit Packing Preference')}</CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">{error}</div>
          )}
          <p className="text-sm text-gray-600 font-mono">{pref.code}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('customName', 'Custom Name (EN)')}</label>
            <CmxInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={pref.name ?? pref.code}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('customNameAr', 'Custom Name (AR)')}</label>
            <CmxInput
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              placeholder={pref.name2 ?? ''}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('extraPrice', 'Extra Price')}</label>
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
            <label className="text-sm text-gray-700">{t('enabled', 'Enabled')}</label>
          </div>
          <CmxDialogFooter>
            {pref.cf_id && (
              <CmxButton type="button" variant="outline" onClick={handleReset} disabled={saving} className="mr-auto">
                {t('resetToDefault', 'Reset to default')}
              </CmxButton>
            )}
            <CmxDialogClose asChild>
              <CmxButton type="button" variant="outline">
                {t('cancel', 'Cancel')}
              </CmxButton>
            </CmxDialogClose>
            <CmxButton type="submit" disabled={saving}>
              {saving ? t('saving', 'Saving...') : t('save', 'Save')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
