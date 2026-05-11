/**
 * RepeatLastOrderPanel
 * "Repeat from last order" - copies preferences from customer's last order.
 * Starter+ feature. Gate by repeatLastOrderEnabled prop.
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { usePreferenceCatalog } from '../../hooks/use-preference-catalog';
import { useNewOrderStateWithDispatch } from '../../hooks/use-new-order-state';
import { CmxButton } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { RotateCcw } from 'lucide-react';
import type { ServicePreference, PackingPreference } from '@/lib/types/service-preferences';
import type { LastOrderPrefItem } from '@/lib/services/preference-resolution.service';

interface RepeatLastOrderPanelProps {
  /** Gate: show only when repeat last order enabled (Starter+) */
  repeatLastOrderEnabled?: boolean;
  branchId?: string | null;
}

export function RepeatLastOrderPanel({
  repeatLastOrderEnabled = true,
  branchId,
}: RepeatLastOrderPanelProps) {
  const t = useTranslations('newOrder.preferences');
  const isRTL = useRTL();
  const [loading, setLoading] = useState(false);
  const { servicePrefs, packingPrefs } = usePreferenceCatalog(branchId);
  const { state, updateItemServicePrefs, updateItemPackingPref } = useNewOrderStateWithDispatch();

  const customerId = state.customer?.id;
  const hasItems = state.items.length > 0;

  const handleRepeatLastOrder = async () => {
    if (!customerId) {
      cmxMessage.warning(t('noLastOrder') || 'Select a customer first');
      return;
    }
    if (!hasItems) {
      cmxMessage.info(t('addItemsFirst') || 'Add items first');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ customerId });
      const res = await fetch(`/api/v1/preferences/last-order?${params}`, {
        credentials: 'include',
      });
      const json = await res.json();

      if (!json.success || !json.data?.length) {
        cmxMessage.info(t('noLastOrder') || 'No previous order found');
        return;
      }

      const priceMap = new Map<string, number>(
        servicePrefs.map((s: ServicePreference) => [s.code, s.default_extra_price])
      );
      const packingCfByCode = new Map<string, string | null>(
        packingPrefs.map((p: PackingPreference) => [p.code, p.packing_cf_id ?? null])
      );
      const serviceCfByCode = new Map<string, string | null>(
        servicePrefs.map((s: ServicePreference) => [s.code, s.preference_cf_id ?? null])
      );

      const lastItems = json.data as LastOrderPrefItem[];

      // Apply to current items: match by product_id or service_category_code
      state.items.forEach((item) => {
        const match =
          lastItems.find((li) => li.product_id === item.productId) ??
          lastItems.find((li) => li.service_category_code === item.serviceCategoryCode);

        if (!match) return;

        const orderServiceCfByCode = new Map<string, string | null>(
          (match.service_prefs_catalog ?? []).map((row) => [
            row.preference_code,
            row.preference_id,
          ])
        );

        if (match.packing_pref_code) {
          const packingCfId =
            match.packing_pref_cf_id ?? packingCfByCode.get(match.packing_pref_code) ?? null;
          updateItemPackingPref(item.productId, match.packing_pref_code, true, 'repeat_last', packingCfId);
        }

        if (match.service_pref_codes?.length) {
          const existing = item.servicePrefs ?? [];
          const existingCodes = new Set(existing.map((p) => p.preference_code));
          const toAdd = match.service_pref_codes.filter((c) => !existingCodes.has(c));

          if (toAdd.length === 0) return;

          const newPrefs = [
            ...existing,
            ...toAdd.map((code) => {
              const fromLastOrder = orderServiceCfByCode.get(code) ?? null;
              const fromCatalog = serviceCfByCode.get(code) ?? null;
              return {
                preference_code: code,
                source: 'repeat_last' as const,
                extra_price: priceMap.get(code) ?? 0,
                preferenceCfId: fromLastOrder ?? fromCatalog ?? undefined,
              };
            }),
          ];
          const charge = newPrefs.reduce((sum, p) => sum + p.extra_price, 0);
          updateItemServicePrefs(item.productId, newPrefs, charge);
        }
      });

      cmxMessage.success(t('appliedSuccess') || 'Preferences applied');
    } catch {
      cmxMessage.error('Failed to load last order preferences');
    } finally {
      setLoading(false);
    }
  };

  if (!repeatLastOrderEnabled) return null;

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-gray-50/50 p-3 ${isRTL ? 'text-right' : 'text-left'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <RotateCcw className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">
          {t('repeatLastOrder') || 'Repeat Last Order'}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        {t('repeatLastOrderDesc') || "Copy preferences from your last order"}
      </p>
      <CmxButton
        variant="outline"
        size="sm"
        onClick={handleRepeatLastOrder}
        disabled={!customerId || !hasItems || loading}
      >
        {loading ? '...' : t('repeatLastOrderBtn') || 'Repeat from last order'}
      </CmxButton>
    </div>
  );
}
