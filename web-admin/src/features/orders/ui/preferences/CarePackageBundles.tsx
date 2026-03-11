/**
 * CarePackageBundles
 * Displays preference bundles (Care Packages) and allows applying to all items.
 * Growth+ feature. Gate by bundlesEnabled prop.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { usePreferenceBundles } from '../../hooks/use-preference-bundles';
import { usePreferenceCatalog } from '../../hooks/use-preference-catalog';
import { useNewOrderStateWithDispatch } from '../../hooks/use-new-order-state';
import { CmxButton } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { Package } from 'lucide-react';
import type { ServicePreference } from '@/lib/types/service-preferences';

interface CarePackageBundlesProps {
  /** Gate: show only when bundles enabled (Growth+) */
  bundlesEnabled?: boolean;
  branchId?: string | null;
}

export function CarePackageBundles({
  bundlesEnabled = true,
  branchId,
}: CarePackageBundlesProps) {
  const t = useTranslations('newOrder.preferences');
  const isRTL = useRTL();
  const { bundles, hasBundles, isLoading } = usePreferenceBundles();
  const { servicePrefs } = usePreferenceCatalog(branchId);
  const { state, updateItemServicePrefs } = useNewOrderStateWithDispatch();

  const handleApplyBundle = (preferenceCodes: string[]) => {
    if (state.items.length === 0) {
      cmxMessage.info(t('addItemsFirst') || 'Add items first');
      return;
    }

    const priceMap = new Map<string, number>(
      servicePrefs.map((s: ServicePreference) => [s.code, s.default_extra_price])
    );

    state.items.forEach((item) => {
      const existing = item.servicePrefs ?? [];
      const existingCodes = new Set(existing.map((p) => p.preference_code));
      const toAdd = preferenceCodes.filter((c) => !existingCodes.has(c));

      if (toAdd.length === 0) return;

      const newPrefs = [
        ...existing,
        ...toAdd.map((code) => ({
          preference_code: code,
          source: 'bundle' as const,
          extra_price: priceMap.get(code) ?? 0,
        })),
      ];
      const charge = newPrefs.reduce((sum, p) => sum + p.extra_price, 0);
      updateItemServicePrefs(item.productId, newPrefs, charge);
    });

    cmxMessage.success(t('appliedSuccess') || 'Preferences applied');
  };

  if (!bundlesEnabled || isLoading || !hasBundles) return null;

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-gray-50/50 p-3 ${isRTL ? 'text-right' : 'text-left'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Package className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">
          {t('carePackages') || 'Care Packages'}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        {t('carePackagesDesc') || 'Apply a bundle of preferences to all items'}
      </p>
      <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {bundles.map((bundle) => (
          <CmxButton
            key={bundle.id}
            variant="outline"
            size="sm"
            onClick={() => handleApplyBundle(bundle.preference_codes)}
            disabled={state.items.length === 0}
          >
            {bundle.name}
          </CmxButton>
        ))}
      </div>
    </div>
  );
}
