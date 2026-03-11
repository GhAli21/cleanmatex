/**
 * Preferences Catalog Page
 * Service and packing preferences catalog; Care Package bundles CRUD
 * Route: /dashboard/catalog/preferences
 * Migration 0139: Order Service Preferences
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CmxCard } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives';
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
  const [loading, setLoading] = useState(true);
  const [servicePrefs, setServicePrefs] = useState<ServicePref[]>([]);
  const [packingPrefs, setPackingPrefs] = useState<PackingPref[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/v1/catalog/service-preferences').then((r) => r.json()),
      fetch('/api/v1/catalog/packing-preferences').then((r) => r.json()),
    ])
      .then(([svcRes, pckRes]) => {
        if (!svcRes?.success) throw new Error(svcRes?.error || 'Failed to load service preferences');
        if (!pckRes?.success) throw new Error(pckRes?.error || 'Failed to load packing preferences');
        setServicePrefs(svcRes.data || []);
        setPackingPrefs(pckRes.data || []);
      })
      .catch((e) => setError(e.message || 'Failed to load catalog'))
      .finally(() => setLoading(false));
  }, [currentTenant]);

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
                {servicePrefs.map((p) => (
                  <li
                    key={p.code}
                    className="flex justify-between items-center py-2 px-3 rounded-md bg-gray-50 text-sm"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-500 text-xs">
                      {p.preference_category} • +{Number(p.default_extra_price ?? 0).toFixed(3)}
                    </span>
                  </li>
                ))}
              </ul>
              {servicePrefs.length === 0 && (
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
                {packingPrefs.map((p) => (
                  <li
                    key={p.code}
                    className="flex justify-between items-center py-2 px-3 rounded-md bg-gray-50 text-sm"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-500 text-xs">{p.maps_to_packaging_type || '—'}</span>
                  </li>
                ))}
              </ul>
              {packingPrefs.length === 0 && (
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
