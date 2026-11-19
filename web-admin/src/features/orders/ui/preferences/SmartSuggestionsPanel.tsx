/**
 * SmartSuggestionsPanel
 * Shows suggested preferences from customer order history.
 * Growth+ feature. Gate by smartSuggestionsEnabled prop.
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePreferenceCatalog } from '../../hooks/use-preference-catalog';
import { useNewOrderStateWithDispatch } from '../../hooks/use-new-order-state';
import { CmxButton } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { Sparkles } from 'lucide-react';
import type { ServicePreference, ServicePreferenceCode } from '@/lib/types/service-preferences';
import type { UseNewOrderStateWithDispatchReturn } from '../../hooks/use-new-order-state';
import type { NewOrderState } from '../../model/new-order-types';

interface SmartSuggestionsPanelProps {
  /** Gate: show only when smart suggestions enabled (Growth+) */
  smartSuggestionsEnabled?: boolean;
  branchId?: string | null;
}

interface Suggestion {
  preference_code: string;
  usage_count: number;
}

interface SmartSuggestionsForCustomerProps {
  customerId: string;
  servicePrefs: ServicePreference[];
  state: NewOrderState;
  updateItemServicePrefs: UseNewOrderStateWithDispatchReturn['updateItemServicePrefs'];
}

function SmartSuggestionsForCustomer({
  customerId,
  servicePrefs,
  state,
  updateItemServicePrefs,
}: SmartSuggestionsForCustomerProps) {
  const t = useTranslations('newOrder.preferences');
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ customerId, limit: '5' });
    fetch(`/api/v1/preferences/suggest?${params}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && json.data?.length) {
          setSuggestions(json.data);
        } else {
          setSuggestions([]);
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const loading = suggestions === null;

  const handleApplySuggestion = (code: ServicePreferenceCode) => {
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

  if (!loading && suggestions.length === 0) return null;

  const nameMap = new Map(servicePrefs.map((s: ServicePreference) => [s.code, s.name]));

  return (
    <div
      data-testid="smart-suggestions-panel"
      className="rounded-lg border border-border bg-muted/50 p-3 text-start"
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground">
          {t('smartSuggestions') || 'Suggested for you'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        {t('smartSuggestionsDesc') || 'Based on your order history'}
      </p>
      {loading ? (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 w-20 animate-pulse rounded-md bg-muted"
              aria-hidden
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <CmxButton
              key={s.preference_code}
              variant="outline"
              size="sm"
              onClick={() => handleApplySuggestion(s.preference_code as ServicePreferenceCode)}
              disabled={state.items.length === 0}
            >
              <span className="flex items-center gap-1.5">
                {nameMap.get(s.preference_code as ServicePreferenceCode) || s.preference_code}
                {s.usage_count > 1 && (
                  <span className="text-xs opacity-75">({s.usage_count}x)</span>
                )}
              </span>
            </CmxButton>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 *
 * @param root0
 * @param root0.smartSuggestionsEnabled
 * @param root0.branchId
 */
export function SmartSuggestionsPanel({
  smartSuggestionsEnabled = true,
  branchId,
}: SmartSuggestionsPanelProps) {
  const { servicePrefs } = usePreferenceCatalog(branchId);
  const { state, updateItemServicePrefs } = useNewOrderStateWithDispatch();
  const customerId = state.customer?.id;

  if (!smartSuggestionsEnabled || !customerId) {
    return null;
  }

  return (
    <SmartSuggestionsForCustomer
      key={customerId}
      customerId={customerId}
      servicePrefs={servicePrefs}
      state={state}
      updateItemServicePrefs={updateItemServicePrefs}
    />
  );
}
