/**
 * Tenant order channel allowlist (org_tenant_order_sources_cf).
 * Empty configuration means all active global sources are allowed.
 * Route: /dashboard/catalog/order-sources
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { RequireAnyPermission } from '@/src/features/auth/ui/RequirePermission';
import { CmxCard } from '@ui/primitives/cmx-card';
import { CmxButton, CmxSwitch } from '@ui/primitives';
import { getCSRFHeader, useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useRTL } from '@/lib/hooks/useRTL';

type SourceRow = {
  order_source_code: string;
  name: string;
  name2: string | null;
  requires_remote_intake_confirm: boolean;
  is_allowed: boolean;
};

export default function OrderSourcesCatalogPage() {
  const t = useTranslations('catalog.orderSources');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isRTL = useRTL();
  const { token: csrfToken } = useCSRFToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [explicitList, setExplicitList] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/catalog/order-sources');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((body as { error?: string }).error ?? t('loadError'));
        return;
      }
      const data = (body as { data?: { sources?: SourceRow[]; tenantHasExplicitAllowList?: boolean } }).data;
      setRows(data?.sources ?? []);
      setExplicitList(Boolean(data?.tenantHasExplicitAllowList));
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (code: string, next: boolean) => {
    setRows((prev) => prev.map((r) => (r.order_source_code === code ? { ...r, is_allowed: next } : r)));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/catalog/order-sources', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? getCSRFHeader(csrfToken) : {}),
        },
        body: JSON.stringify({
          entries: rows.map((r) => ({
            order_source_code: r.order_source_code,
            is_allowed: r.is_allowed,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? t('saveError'));
        return;
      }
      await load();
    } catch {
      setError(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const clearExplicit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/catalog/order-sources', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? getCSRFHeader(csrfToken) : {}),
        },
        body: JSON.stringify({ entries: [] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? t('saveError'));
        return;
      }
      await load();
    } catch {
      setError(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequireAnyPermission permissions={['config:preferences_manage']}>
      <div className="space-y-6 p-6">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
          </div>
          <Link href="/dashboard/catalog/preferences" className="text-sm text-blue-600 hover:text-blue-700">
            {t('backToPreferences')}
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}

        <CmxCard>
          <div className={`flex flex-col gap-4 p-4 ${isRTL ? 'text-right' : 'text-left'}`}>
            <p className="text-sm text-gray-600">{explicitList ? t('explicitListHelp') : t('defaultAllHelp')}</p>
            {loading ? (
              <p className="text-sm text-gray-500">{tCommon('loading')}</p>
            ) : (
              <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
                {rows.map((r) => (
                  <li
                    key={r.order_source_code}
                    className={`flex items-center gap-4 px-4 py-3 ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {locale === 'ar' && r.name2?.trim() ? r.name2 : r.name}
                      </div>
                      <div className="text-xs text-gray-500">{r.order_source_code}</div>
                      {r.requires_remote_intake_confirm && (
                        <div className="mt-1 text-xs text-amber-800">{t('remoteIntakeFlag')}</div>
                      )}
                    </div>
                    <CmxSwitch checked={r.is_allowed} onCheckedChange={(v) => toggle(r.order_source_code, v)} />
                  </li>
                ))}
              </ul>
            )}
            <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <CmxButton variant="primary" onClick={() => void save()} disabled={saving || loading}>
                {saving ? t('saving') : t('save')}
              </CmxButton>
              <CmxButton variant="secondary" onClick={() => void clearExplicit()} disabled={saving || loading}>
                {t('resetToAllowAll')}
              </CmxButton>
            </div>
          </div>
        </CmxCard>
      </div>
    </RequireAnyPermission>
  );
}
