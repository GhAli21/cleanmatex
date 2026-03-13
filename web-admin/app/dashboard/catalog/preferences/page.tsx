/**
 * Preferences Catalog Page
 * Service and packing preferences catalog; Care Package bundles CRUD
 * Route: /dashboard/catalog/preferences
 * Migration 0139: Order Service Preferences
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePreferenceBundles } from '@/src/features/orders/hooks/use-preference-bundles';
import { CmxCard } from '@ui/primitives/cmx-card';
import { CmxButton, CmxInput, CmxSwitch } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogClose,
} from '@ui/overlays';
import { Package, Shirt, Plus, Pencil, Trash2, Gift } from 'lucide-react';
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

export default function PreferencesCatalogPage() {
  const t = useTranslations('catalog.preferences');
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
    ])
      .then(([svcRes, pckRes, svcAdminRes, pckAdminRes]) => {
        if (!svcRes?.success) throw new Error(svcRes?.error || 'Failed to load service preferences');
        if (!pckRes?.success) throw new Error(pckRes?.error || 'Failed to load packing preferences');
        setServicePrefs(svcRes.data || []);
        setPackingPrefs(pckRes.data || []);
        if (svcAdminRes?.success) setServicePrefsAdmin(svcAdminRes.data || []);
        if (pckAdminRes?.success) setPackingPrefsAdmin(pckAdminRes.data || []);
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

  return (
    <RequireAnyPermission
      permissions={['orders:service_prefs_view', 'orders:read', 'config:preferences_manage']}
      fallback={
        <CmxCard className="p-6">
          <p className="text-gray-600">You do not have permission to view the preferences catalog.</p>
        </CmxCard>
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('title', { defaultValue: 'Preferences Catalog' })}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('subtitle', { defaultValue: 'Service and packing preferences for orders' })}
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        )}

        {error && (
          <CmxCard className="p-6 border-red-200 bg-red-50">
            <p className="text-red-800">{error}</p>
          </CmxCard>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CmxCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shirt className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('servicePrefs', { defaultValue: 'Service Preferences' })}
                </h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {t('servicePrefsDesc', 'Processing options: starch, perfume, delicate, etc.')}
              </p>
              <ul className="space-y-2">
                {(servicePrefsAdmin.length > 0 ? servicePrefsAdmin : servicePrefs).map((p) => {
                  const isAdmin = servicePrefsAdmin.length > 0;
                  const adminRow = isAdmin ? (p as ServicePrefAdmin) : null;
                  const displayName = adminRow ? (adminRow.cf_name ?? adminRow.name) : (p as ServicePref).name;
                  const displayPrice = adminRow ? (adminRow.cf_extra_price ?? adminRow.default_extra_price) : ((p as ServicePref).default_extra_price ?? 0);
                  const isDisabled = adminRow ? adminRow.cf_is_active === false : false;
                  return (
                    <li
                      key={p.code}
                      className={`flex justify-between items-center py-2 px-3 rounded-md text-sm ${isDisabled ? 'bg-gray-100 opacity-75' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{displayName}</span>
                        {isDisabled && (
                          <span className="text-xs text-gray-500">({t('inactive', 'Inactive')})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">
                          {(adminRow?.preference_category ?? (p as ServicePref).preference_category) || ''} • +{Number(displayPrice).toFixed(3)}
                        </span>
                        {isAdmin && (
                          <RequireAnyPermission permissions={['config:preferences_manage']} fallback={null}>
                            <CmxButton
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => setEditingServicePref(adminRow!)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </CmxButton>
                          </RequireAnyPermission>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {servicePrefs.length === 0 && servicePrefsAdmin.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">{t('noServicePrefs', 'No service preferences configured')}</p>
              )}
            </CmxCard>

            <CmxCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('packingPrefs', { defaultValue: 'Packing Preferences' })}
                </h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {t('packingPrefsDesc', 'Assembly options: hang, fold, box, etc.')}
              </p>
              <ul className="space-y-2">
                {(packingPrefsAdmin.length > 0 ? packingPrefsAdmin : packingPrefs).map((p) => {
                  const isAdmin = packingPrefsAdmin.length > 0;
                  const adminRow = isAdmin ? (p as PackingPrefAdmin) : null;
                  const displayName = adminRow ? (adminRow.cf_name ?? adminRow.name) : (p as PackingPref).name;
                  const isDisabled = adminRow ? adminRow.cf_is_active === false : false;
                  return (
                    <li
                      key={p.code}
                      className={`flex justify-between items-center py-2 px-3 rounded-md text-sm ${isDisabled ? 'bg-gray-100 opacity-75' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{displayName}</span>
                        {isDisabled && (
                          <span className="text-xs text-gray-500">({t('inactive', 'Inactive')})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">{(adminRow?.maps_to_packaging_type ?? (p as PackingPref).maps_to_packaging_type) || '—'}</span>
                        {isAdmin && (
                          <RequireAnyPermission permissions={['config:preferences_manage']} fallback={null}>
                            <CmxButton
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => setEditingPackingPref(adminRow!)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </CmxButton>
                          </RequireAnyPermission>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {packingPrefs.length === 0 && packingPrefsAdmin.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">{t('noPackingPrefs', 'No packing preferences configured')}</p>
              )}
            </CmxCard>

            <CmxCard className="p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-purple-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t('bundles', { defaultValue: 'Care Packages' })}
                  </h2>
                </div>
                <RequireAnyPermission permissions={['config:preferences_manage']} fallback={null}>
                  <CmxButton
                    size="sm"
                    onClick={() => {
                      setEditingBundle(null);
                      setBundleDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t('addBundle', { defaultValue: 'Add Bundle' })}
                  </CmxButton>
                </RequireAnyPermission>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {t('bundlesDesc', 'Preference bundles for quick apply (Growth+)')}
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 font-medium text-gray-700">{t('bundleCode', 'Code')}</th>
                      <th className="text-left py-2 font-medium text-gray-700">{t('bundleName', 'Name')}</th>
                      <th className="text-left py-2 font-medium text-gray-700">{t('preferences', 'Preferences')}</th>
                      <th className="text-left py-2 font-medium text-gray-700">{t('discount', 'Discount')}</th>
                      <th className="text-left py-2 font-medium text-gray-700">{t('status', 'Status')}</th>
                      <RequireAnyPermission permissions={['config:preferences_manage']} fallback={<th />}>
                        <th className="text-right py-2 font-medium text-gray-700">{t('actions', 'Actions')}</th>
                      </RequireAnyPermission>
                    </tr>
                  </thead>
                  <tbody>
                    {bundles.map((b) => (
                      <tr key={b.id} className="border-b border-gray-100">
                        <td className="py-2 font-mono text-xs">{b.bundle_code}</td>
                        <td className="py-2">{b.name}</td>
                        <td className="py-2 text-gray-600">
                          {(b.preference_codes || []).join(', ') || '—'}
                        </td>
                        <td className="py-2">
                          {(b.discount_percent ?? 0) > 0
                            ? `${b.discount_percent}%`
                            : (b.discount_amount ?? 0) > 0
                              ? `${Number(b.discount_amount).toFixed(3)}`
                              : '—'}
                        </td>
                        <td className="py-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs ${
                              b.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {b.is_active ? t('active', 'Active') : t('inactive', 'Inactive')}
                          </span>
                        </td>
                        <RequireAnyPermission permissions={['config:preferences_manage']} fallback={<td />}>
                          <td className="py-2 text-right">
                            <CmxButton
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => {
                                setEditingBundle(b);
                                setBundleDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </CmxButton>
                            <CmxButton
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-red-600 hover:text-red-700"
                              onClick={() => {
                                if (confirm(t('confirmDeleteBundle', 'Delete this bundle?'))) {
                                  deleteBundleMutation.mutate(b.id);
                                }
                              }}
                              disabled={deleteBundleMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </CmxButton>
                          </td>
                        </RequireAnyPermission>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {bundles.length === 0 && (
                <p className="text-sm text-gray-500 mt-4">{t('noBundles', 'No care packages configured')}</p>
              )}
            </CmxCard>
          </div>
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
            <input
              type="text"
              value={bundleCode}
              onChange={(e) => setBundleCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="e.g. DELICATE_STARCH"
              required
              disabled={!!bundle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('bundleName', 'Name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="e.g. Delicate + Light Starch"
              required
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
