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
import { ServicePreferenceSelector } from './ServicePreferenceSelector';
import { CarePackageBundles } from './CarePackageBundles';
import { RepeatLastOrderPanel } from './RepeatLastOrderPanel';
import { SmartSuggestionsPanel } from './SmartSuggestionsPanel';
import type { PreSubmissionPiece } from '../../model/new-order-types';
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
  const { state, updateItemServicePrefs, updateItemPieces } = useNewOrderStateWithDispatch();
  const { servicePrefs } = usePreferenceCatalog(state.branchId);

  const [activePrefTab, setActivePrefTab] = useState<'quick' | 'service'>('quick');

  const hasQuickApply = bundlesEnabled || repeatLastOrderEnabled || smartSuggestionsEnabled;
  const hasAnyPrefs = hasQuickApply || hasServicePrefs;

  if (!hasAnyPrefs) return null;

  const handlePieceUpdate = (
    productId: string,
    pieceId: string,
    updates: Partial<PreSubmissionPiece>
  ) => {
    const item = state.items.find((c) => c.productId === productId);
    if (!item) return;
    const existingPieces: PreSubmissionPiece[] = item.pieces ?? [];
    const updatedPieces = existingPieces.map((p) =>
      p.id === pieceId ? { ...p, ...updates } : p
    );
    updateItemPieces(productId, updatedPieces);

    // When piece-level servicePrefs change, recalculate item.servicePrefCharge
    if ('servicePrefs' in updates) {
      const pieceCharge = (updatedPieces: PreSubmissionPiece[]) =>
        updatedPieces.reduce(
          (sum, p) =>
            sum +
            (p.servicePrefs ?? []).reduce((s, pref) => s + (pref.extra_price ?? 0), 0),
          0
        );
      const newCharge = pieceCharge(updatedPieces);
      updateItemServicePrefs(productId, item.servicePrefs ?? [], newCharge);
    }
  };

  return (
    <div className="border-b border-gray-100">
      <div
        className={`flex gap-1 p-2 bg-gray-50 rounded-t-lg border-b border-gray-200 ${isRTL ? 'flex-row-reverse' : ''}`}
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
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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
                'Configure service preferences (starch, perfume, delicate, etc.) per item or per piece.'}
            </p>
            <div className="space-y-4 max-h-[40vh] overflow-y-auto">
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
                      <span className="text-gray-500 font-normal ml-1">
                        ({item.pieces?.length} {tPieces('pieces')})
                      </span>
                    )}
                  </div>

                  {!trackByPiece || (item.pieces?.length ?? 0) === 0 ? (
                    <ServicePreferenceSelector
                      selectedPrefs={item.servicePrefs ?? []}
                      availablePrefs={servicePrefs}
                      onChange={(prefs, charge) =>
                        updateItemServicePrefs(item.productId, prefs, charge)
                      }
                      enforceCompatibility={enforcePrefCompatibility}
                    />
                  ) : (
                    <div className="space-y-3">
                      {(item.pieces ?? []).map((piece) => (
                        <div
                          key={piece.id}
                          className="flex flex-wrap items-center gap-3 pl-4 border-l-2 border-gray-200"
                        >
                          <span className="text-xs font-medium text-gray-600 min-w-[4rem]">
                            {tPieces('pieceNumber', { number: piece.pieceSeq })}
                          </span>
                          <ServicePreferenceSelector
                            selectedPrefs={piece.servicePrefs ?? []}
                            availablePrefs={servicePrefs}
                            onChange={(prefs) =>
                              handlePieceUpdate(item.productId, piece.id, {
                                servicePrefs: prefs,
                              })
                            }
                            maxPrefs={5}
                            enforceCompatibility={enforcePrefCompatibility}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
