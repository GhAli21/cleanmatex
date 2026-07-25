/**
 * PreferencesTabsSection
 * Tabbed preferences section: Quick Apply (bundles, repeat, suggestions) | Service Preferences
 * Service prefs moved from order item details table to this dedicated tab.
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/utils/bilingual';
import { useNewOrderStateWithDispatch } from '../../hooks/use-new-order-state';
import { usePreferenceCatalog } from '../../hooks/use-preference-catalog';
import { LevelPreferenceCard } from './LevelPreferenceCard';
import { CarePackageBundles } from './CarePackageBundles';
import { RepeatLastOrderPanel } from './RepeatLastOrderPanel';
import { SmartSuggestionsPanel } from './SmartSuggestionsPanel';
import { Zap, Settings2 } from 'lucide-react';

interface PreferencesTabsSectionProps {
  trackByPiece: boolean;
  packingPerPieceEnabled?: boolean;
  bundlesEnabled?: boolean;
  repeatLastOrderEnabled?: boolean;
  smartSuggestionsEnabled?: boolean;
  enforcePrefCompatibility?: boolean;
  hasServicePrefs: boolean;
}

/**
 *
 * @param root0
 * @param root0.trackByPiece
 * @param root0.packingPerPieceEnabled
 * @param root0.bundlesEnabled
 * @param root0.repeatLastOrderEnabled
 * @param root0.smartSuggestionsEnabled
 * @param root0.enforcePrefCompatibility
 * @param root0.hasServicePrefs
 */
export function PreferencesTabsSection({
  trackByPiece,
  packingPerPieceEnabled = true,
  bundlesEnabled = false,
  repeatLastOrderEnabled = true,
  smartSuggestionsEnabled = false,
  enforcePrefCompatibility = false,
  hasServicePrefs,
}: PreferencesTabsSectionProps) {
  const t = useTranslations('newOrder.preferences');
  const tPieces = useTranslations('newOrder.pieces');
  const tItems = useTranslations('newOrder.itemsGrid');
  const isRTL = useRTL();
  const getBilingual = useBilingual();
  const {
    state,
    updateItemServicePrefs,
    updateItemPackingPref,
  } = useNewOrderStateWithDispatch();
  const { servicePrefs, packingPrefs, preferenceKinds, prefsByKind, kindsLoading } =
    usePreferenceCatalog(state.branchId, true);

  // B18 redesign: order-level preferences moved to OrderPreferencesDialog,
  // reachable via the sticky top bar's "Preferences" pill on every step —
  // not nested in this tab, since staff kept losing track of it here.
  // Piece-level preferences live exclusively in the "Edit Items Preferences"
  // wizard step (OrderPiecePreferencesSection); this tab is items only now.
  // LevelPreferenceCard filters `preferenceKinds` down to the PREFERENCES
  // main type internally, and additionally hides packing_prefs whenever
  // `onPackingChange` is omitted.

  const [activePrefTab, setActivePrefTab] = useState<'quick' | 'service'>('quick');

  const hasQuickApply = bundlesEnabled || repeatLastOrderEnabled || smartSuggestionsEnabled;
  const hasAnyPrefs = hasQuickApply || hasServicePrefs;

  if (!hasAnyPrefs) return null;

  return (
    <div className="border-b border-gray-100">
      <div
        className={`flex gap-1 p-2 bg-gray-50 rounded-t-lg border-b border-gray-200 overflow-x-auto ${isRTL ? 'flex-row-reverse' : ''}`}
        role="tablist"
        aria-label={t('preferences') || 'Preferences'}
      >
        {hasQuickApply && (
          <button
            type="button"
            role="tab"
            aria-selected={activePrefTab === 'quick'}
            aria-controls="prefs-quick-panel"
            id="prefs-quick-tab"
            onClick={() => setActivePrefTab('quick')}
            className={`inline-flex items-center gap-2 px-4 min-h-[44px] py-2 rounded-md text-sm font-medium transition-colors flex-shrink-0 ${
              activePrefTab === 'quick'
                ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            } ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Zap className="w-4 h-4" />
            {t('quickApply') || 'Quick Apply'}
          </button>
        )}
        {hasServicePrefs && (
          <button
            type="button"
            role="tab"
            aria-selected={activePrefTab === 'service'}
            aria-controls="prefs-service-panel"
            id="prefs-service-tab"
            onClick={() => setActivePrefTab('service')}
            className={`inline-flex items-center gap-2 px-4 min-h-[44px] py-2 rounded-md text-sm font-medium transition-colors flex-shrink-0 ${
              activePrefTab === 'service'
                ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            } ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Settings2 className="w-4 h-4" />
            {t('servicePrefs') || 'Service Preferences'}
          </button>
        )}
      </div>

      <div className="p-4 bg-white">
        {activePrefTab === 'quick' && hasQuickApply && (
          <div
            id="prefs-quick-panel"
            role="tabpanel"
            aria-labelledby="prefs-quick-tab"
            className="space-y-3"
          >
            <CarePackageBundles bundlesEnabled={bundlesEnabled} branchId={state.branchId} />
            <RepeatLastOrderPanel
              repeatLastOrderEnabled={repeatLastOrderEnabled}
              branchId={state.branchId}
            />
            <SmartSuggestionsPanel
              smartSuggestionsEnabled={smartSuggestionsEnabled}
              branchId={state.branchId}
            />
          </div>
        )}

        {activePrefTab === 'service' && hasServicePrefs && (
          <div
            id="prefs-service-panel"
            role="tabpanel"
            aria-labelledby="prefs-service-tab"
            className="space-y-4"
          >
            <p className="text-xs text-gray-500">
              {t('servicePrefsDesc') ||
                'Configure service and packing preferences per item. Use the Preferences button in the top bar for whole-order preferences.'}
            </p>

            <div className="space-y-4 max-h-[50vh] sm:max-h-[40vh] overflow-y-auto">
              {state.items.map((item) => (
                <div
                  key={item.productId}
                  className="rounded-lg border border-gray-200 p-3 bg-gray-50/50"
                >
                  <div
                    className={`font-medium text-sm text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {getBilingual(item.productName, item.productName2) ||
                      tItems('unknownProduct') ||
                      'Item'}
                    {trackByPiece && (item.pieces?.length ?? 0) > 0 && (
                      <span className="text-gray-500 font-normal ms-1">
                        ({item.pieces?.length} {tPieces('pieces')})
                      </span>
                    )}
                  </div>

                  {/* B18 — item-level card shown always (not just when untracked-by-piece),
                      so an operator can add a whole-item preference in addition to per-piece ones. */}
                  <div>
                    {trackByPiece && (item.pieces?.length ?? 0) > 0 && (
                      <span className="text-xs font-medium text-gray-600 mb-1 block">
                        {tItems('wholeItem') || 'Whole item'}
                      </span>
                    )}
                    <LevelPreferenceCard
                      title=""
                      bare
                      servicePrefs={item.servicePrefs ?? []}
                      packingPrefCode={item.packingPrefCode}
                      preferenceKinds={preferenceKinds}
                      prefsByKind={prefsByKind}
                      packingPrefs={packingPrefs}
                      servicePrefsFallback={servicePrefs}
                      currencyCode=""
                      kindsLoading={kindsLoading}
                      enforcePrefCompatibility={enforcePrefCompatibility}
                      onServicePrefsChange={(prefs, charge) =>
                        updateItemServicePrefs(item.productId, prefs, charge)
                      }
                      onPackingChange={(code, packingCfId) => {
                        const charge = code
                          ? Number(packingPrefs.find((p) => p.code === code)?.default_extra_price ?? 0)
                          : 0;
                        updateItemPackingPref(item.productId, code ?? '', false, 'manual', packingCfId, charge);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
