/**
 * SmartSuggestionsPanel
 * Shows suggested preferences from customer order history.
 * Growth+ feature. Gate by smartSuggestionsEnabled prop.
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { usePreferenceCatalog } from '../../hooks/use-preference-catalog';
import { useNewOrderStateWithDispatch } from '../../hooks/use-new-order-state';
import { CmxButton } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { Sparkles } from 'lucide-react';
import type { ServicePreference } from '@/lib/types/service-preferences';

interface SmartSuggestionsPanelProps {
  /** Gate: show only when smart suggestions enabled (Growth+) */
  smartSuggestionsEnabled?: boolean;
  branchId?: string | null;
}

interface Suggestion {
  preference_code: string;
  usage_count: number;
}

export function SmartSuggestionsPanel({
  smartSuggestionsEnabled = true,
  branchId,
}: SmartSuggestionsPanelProps) {
  const t = useTranslations('newOrder.preferences');
  const isRTL = useRTL();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const { servicePrefs } = usePreferenceCatalog(branchId);
  const { state, updateItemServicePrefs } = useNewOrderStateWithDispatch();

  const customerId = state.customer?.id;

  useEffect(() => {
    if (!smartSuggestionsEnabled || !customerId) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({ customerId, limit: '5' });
    fetch(`/api/v1/preferences/suggest?${params}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.length) {
          setSuggestions(json.data);
        } else {
          setSuggestions([]);
        }
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [smartSuggestionsEnabled, customerId]);

  const handleApplySuggestion = (code: string) => {
    if (state.items.length === 0) {
      cmxMessage.info(t('addItemsFirst') || 'Add items first');
      return;
    }

    const pref = servicePrefs.find((s: ServicePreference) => s.code === code);
    const extraPrice = pref?.default_extra_price ?? 0;

    state.items.forEach((item) => {
      const existing = item.servicePrefs ?? [];
      if (existing.some((p) => p.preference_code === code)) return;

      const newPrefs = [
        ...existing,
        { preference_code: code, source: 'suggestion' as const, extra_price: extraPrice },
      ];
      const charge = newPrefs.reduce((sum, p) => sum + p.extra_price, 0);
      updateItemServicePrefs(item.productId, newPrefs, charge);
    });

    cmxMessage.success(t('appliedSuccess') || 'Preferences applied');
  };

  if (!smartSuggestionsEnabled || (!loading && suggestions.length === 0)) return null;

  const nameMap = new Map(servicePrefs.map((s: ServicePreference) => [s.code, s.name]));

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-gray-50/50 p-3 ${isRTL ? 'text-right' : 'text-left'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">
          {t('smartSuggestions') || 'Suggested for you'}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        {t('smartSuggestionsDesc') || 'Based on your order history'}
      </p>
      {loading ? (
        <span className="text-xs text-gray-500">Loading...</span>
      ) : (
        <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {suggestions.map((s) => (
            <CmxButton
              key={s.preference_code}
              variant="outline"
              size="sm"
              onClick={() => handleApplySuggestion(s.preference_code)}
              disabled={state.items.length === 0}
            >
              {nameMap.get(s.preference_code) || s.preference_code}
            </CmxButton>
          ))}
        </div>
      )}
    </div>
  );
}
