'use client';

/**
 * Customer Preferences Tab
 * Manages standing service preferences (org_customer_service_prefs) for a customer.
 * Add/remove preferences; uses catalog API for available options.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton } from '@ui/primitives';
import { CmxCard } from '@ui/primitives/cmx-card';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms';
import { Plus, Trash2 } from 'lucide-react';
import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';

interface CustomerPref {
  id: string;
  customer_id: string;
  preference_code: string;
  source: string;
  is_active: boolean;
}

interface ServicePref {
  code: string;
  name: string;
  name2?: string | null;
}

interface CustomerPreferencesTabProps {
  customerId: string;
}

export function CustomerPreferencesTab({ customerId }: CustomerPreferencesTabProps) {
  const t = useTranslations('customers');
  const isRTL = useRTL();
  const [prefs, setPrefs] = useState<CustomerPref[]>([]);
  const [servicePrefs, setServicePrefs] = useState<ServicePref[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingCode, setAddingCode] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadPrefs = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/service-prefs`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to load preferences');
      setPrefs(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    }
  }, [customerId]);

  const loadServicePrefs = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/catalog/service-preferences', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data?.success) return;
      setServicePrefs(data.data || []);
    } catch {
      // Ignore; catalog may not be available
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([loadPrefs(), loadServicePrefs()]).finally(() => setLoading(false));
  }, [loadPrefs, loadServicePrefs]);

  const handleAdd = async (preferenceCode: string) => {
    setAddingCode(preferenceCode);
    setError(null);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/service-prefs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader() },
        body: JSON.stringify({ preference_code: preferenceCode, source: 'customer_pref' }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to add preference');
      await loadPrefs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add preference');
    } finally {
      setAddingCode(null);
    }
  };

  const handleRemove = async (prefId: string) => {
    setRemovingId(prefId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/service-prefs?prefId=${prefId}`, {
        method: 'DELETE',
        headers: getCSRFHeader(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to remove preference');
      await loadPrefs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove preference');
    } finally {
      setRemovingId(null);
    }
  };

  const existingCodes = new Set(prefs.map((p) => p.preference_code));
  const availableToAdd = servicePrefs.filter((s) => !existingCodes.has(s.code));
  const nameMap = new Map(servicePrefs.map((s) => [s.code, s.name]));

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t('standingPreferences', { defaultValue: 'Standing Preferences' })}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {t('standingPreferencesDesc', {
            defaultValue: 'Service preferences applied by default when creating orders for this customer.',
          })}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">{error}</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <CmxSelectDropdown
          value=""
          onValueChange={(value) => value && handleAdd(value)}
          disabled={availableToAdd.length === 0}
        >
          <CmxSelectDropdownTrigger className="w-auto min-w-[180px]">
            <CmxSelectDropdownValue placeholder={t('addPreference', { defaultValue: 'Add Preference' })} />
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            {availableToAdd.map((s) => (
              <CmxSelectDropdownItem
                key={s.code}
                value={s.code}
                disabled={addingCode === s.code}
              >
                {s.name}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>
      </div>

      {prefs.length === 0 ? (
        <CmxCard className="p-6">
          <p className="text-sm text-gray-500">
            {t('noPreferences', { defaultValue: 'No standing preferences configured.' })}
          </p>
        </CmxCard>
      ) : (
        <ul className={`space-y-2 ${isRTL ? 'text-right' : 'text-left'}`}>
          {prefs.map((p) => (
            <li
              key={p.id}
              className="flex justify-between items-center py-2 px-3 rounded-md bg-gray-50 text-sm"
            >
              <span className="font-medium">{nameMap.get(p.preference_code) || p.preference_code}</span>
              <CmxButton
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-red-600 hover:text-red-700"
                onClick={() => handleRemove(p.id)}
                disabled={removingId === p.id}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </CmxButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
