/**
 * "Edit Items Preferences" wizard tab — vertical list of PiecePreferenceCard (no table).
 */

'use client';

import { useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback';
import { useNewOrderStateWithDispatch } from '@/src/features/orders/hooks/use-new-order-state';
import type { PackingPreference, PreferenceKind, ServicePreference } from '@/lib/types/service-preferences';
import type { OrderItem } from '@/src/features/orders/model/new-order-types';
import { generatePiecesForItem } from '@/lib/utils/piece-helpers';
import { useNewOrderPiecePreferences } from '@/src/features/orders/hooks/use-new-order-piece-preferences';
import { useBilingual } from '@/lib/utils/bilingual';
import { PiecePreferenceCard } from './piece-preference-card';

interface ConditionCatalog {
  stains: ServicePreference[];
  damages: ServicePreference[];
  colors: ServicePreference[];
}

export interface OrderPiecePreferencesSectionProps {
  preferenceKinds: PreferenceKind[];
  prefsByKind: Map<string, ServicePreference[]>;
  packingPrefs: PackingPreference[];
  servicePrefsFallback: ServicePreference[];
  conditionCatalog: ConditionCatalog;
  kindsLoading: boolean;
  currencyCode: string;
  enforcePrefCompatibility?: boolean;
}

export function OrderPiecePreferencesSection({
  preferenceKinds,
  prefsByKind,
  packingPrefs,
  servicePrefsFallback,
  conditionCatalog,
  kindsLoading,
  currencyCode,
  enforcePrefCompatibility = false,
}: OrderPiecePreferencesSectionProps) {
  const t = useTranslations('newOrder.piecePreferences');
  const { state, updateItemPieces } = useNewOrderStateWithDispatch();
  const {
    pieceToSelectedPreferences,
    removePreference,
    copySinglePreference,
    copyAllPreferences,
    updatePieceFields,
  } = useNewOrderPiecePreferences();
  const getBilingual = useBilingual();

  useEffect(() => {
    for (const item of state.items) {
      if (item.quantity <= 0) continue;
      const ok = item.pieces && item.pieces.length === item.quantity;
      if (!ok) {
        updateItemPieces(item.productId, generatePiecesForItem(item.productId, item.quantity));
      }
    }
  }, [state.items, updateItemPieces]);

  const itemGroups = useMemo(() => {
    return state.items.map((item: OrderItem) => {
      const pieces =
        item.pieces && item.pieces.length > 0
          ? item.pieces
          : Array.from({ length: item.quantity }, (_, i) => ({
              id: `temp-${item.productId}-${i + 1}`,
              itemId: item.productId,
              pieceSeq: i + 1,
            }));
      const cat = state.categories.find((c) => c.service_category_code === item.serviceCategoryCode);
      const categoryLabel =
        cat != null ? (getBilingual(cat.ctg_name, cat.ctg_name2 ?? null) || undefined) : undefined;
      return { item, pieces, categoryLabel };
    });
  }, [state.items, state.categories, getBilingual]);

  return (
    <section aria-label={t('sectionTitle')} className="space-y-3">
      <h2 className="text-base font-semibold text-gray-900">{t('sectionTitle')}</h2>
      <p className="text-sm text-gray-600">{t('sectionHint')}</p>

      <div className="space-y-3">
        {itemGroups.map(({ item, pieces, categoryLabel }) => {
          const title = getBilingual(item.productName, item.productName2) || '—';
          const siblingIds = pieces.map((p) => p.id);
          return (
            <div key={item.productId} className="space-y-3">
              <div className="text-sm font-medium text-gray-700">{title}</div>
              {pieces.map((piece) => (
                <PiecePreferenceCard
                  key={piece.id}
                  categoryLabel={categoryLabel}
                  itemTitle={title}
                  piece={piece}
                  preferences={pieceToSelectedPreferences(piece)}
                  preferenceKinds={preferenceKinds}
                  prefsByKind={prefsByKind}
                  packingPrefs={packingPrefs}
                  servicePrefsFallback={servicePrefsFallback}
                  conditionCatalog={conditionCatalog}
                  currencyCode={currencyCode}
                  kindsLoading={kindsLoading}
                  enforcePrefCompatibility={enforcePrefCompatibility}
                  siblingPieceIds={siblingIds}
                  copyAllTooltip={t('copyAllTooltip')}
                  onRemovePreference={removePreference}
                  onCopyPreferenceToPieces={(uiId, targets) => {
                    copySinglePreference(uiId, targets);
                    cmxMessage.success(t('copiedPreference'));
                  }}
                  onCopyAllToPieces={(targets) => {
                    copyAllPreferences(piece.id, targets);
                    cmxMessage.success(t('copiedAll'));
                  }}
                  updatePieceFields={updatePieceFields}
                />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
