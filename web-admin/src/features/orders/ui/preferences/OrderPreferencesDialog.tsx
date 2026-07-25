/**
 * OrderPreferencesDialog — order-wide (not item/piece) service preferences,
 * triggered from the sticky NewOrderTopBar pill so it's reachable from any
 * step, not buried inside the Step 2 "Service Preferences" sub-tab.
 * Self-contained: owns its own catalog fetch and order-state binding, so the
 * top bar only needs an open flag + a count for the badge.
 */

'use client';

import { useTranslations } from 'next-intl';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { useNewOrderStateWithDispatch } from '../../hooks/use-new-order-state';
import { usePreferenceCatalog } from '../../hooks/use-preference-catalog';
import { LevelPreferenceCard } from './LevelPreferenceCard';

export interface OrderPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enforcePrefCompatibility?: boolean;
}

export function OrderPreferencesDialog({
  open,
  onOpenChange,
  enforcePrefCompatibility = false,
}: OrderPreferencesDialogProps) {
  const t = useTranslations('newOrder.preferences');
  const { state, updateOrderServicePrefs } = useNewOrderStateWithDispatch();
  const { servicePrefs, preferenceKinds, prefsByKind, packingPrefs, kindsLoading } =
    usePreferenceCatalog(state.branchId, true);

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="w-full max-w-lg p-0 sm:max-w-xl">
        <CmxDialogHeader className="border-b border-gray-100 px-4 py-3">
          <CmxDialogTitle>{t('orderLevelPrefs') || 'Whole Order'}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="max-h-[min(70vh,520px)] overflow-y-auto px-4 py-4">
          <p className="mb-3 text-xs text-gray-500">
            {t('orderLevelPrefsDialogDesc') ||
              'Applies to the whole order regardless of which items are added.'}
          </p>
          <LevelPreferenceCard
            title=""
            bare
            servicePrefs={state.orderServicePrefs ?? []}
            preferenceKinds={preferenceKinds}
            prefsByKind={prefsByKind}
            packingPrefs={packingPrefs}
            servicePrefsFallback={servicePrefs}
            currencyCode=""
            kindsLoading={kindsLoading}
            enforcePrefCompatibility={enforcePrefCompatibility}
            onServicePrefsChange={(prefs) => updateOrderServicePrefs(prefs)}
          />
        </div>
      </CmxDialogContent>
    </CmxDialog>
  );
}
