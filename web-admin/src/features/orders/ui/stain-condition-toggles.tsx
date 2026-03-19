/**
 * Stain/Condition Toggles Component
 * Toggle buttons for item conditions, repairs, or stains
 * Re-Design: PRD-010 Advanced Orders - Section 3C
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/utils/bilingual';
import { STAIN_CONDITIONS, StainCondition } from '@/lib/types/order-creation';

interface CatalogEntry {
  code: string;
  name: string;
  name2?: string | null;
  icon?: string | null;
}

interface StainConditionTogglesProps {
  selectedConditions: string[];
  onConditionToggle: (conditionCode: string) => void;
  disabled?: boolean;
  defaultFilter?: 'all' | 'stain' | 'damage';
  hideFilterBar?: boolean;
  // Catalog data from DB (falls back to STAIN_CONDITIONS if not provided or empty)
  stainCatalog?: CatalogEntry[];
  damageCatalog?: CatalogEntry[];
}

export function StainConditionToggles({
  selectedConditions,
  onConditionToggle,
  disabled = false,
  defaultFilter,
  hideFilterBar = false,
  stainCatalog,
  damageCatalog,
}: StainConditionTogglesProps) {
  const t = useTranslations('newOrder.notesPalette');
  const isRTL = useRTL();
  const getBilingual = useBilingual();
  const [filter, setFilter] = useState<'all' | 'stain' | 'damage'>(defaultFilter ?? 'all');

  // Map catalog entries to StainCondition shape
  const toCondition = (
    items: CatalogEntry[],
    category: StainCondition['category']
  ): StainCondition[] =>
    items.map((p) => ({
      code: p.code,
      label: p.name,
      label2: p.name2 ?? undefined,
      icon: p.icon ?? undefined,
      category,
    }));

  const stains =
    stainCatalog && stainCatalog.length > 0
      ? toCondition(stainCatalog, 'stain')
      : STAIN_CONDITIONS.filter((c) => c.category === 'stain');

  const damages =
    damageCatalog && damageCatalog.length > 0
      ? toCondition(damageCatalog, 'damage')
      : STAIN_CONDITIONS.filter((c) => c.category === 'damage' || c.category === 'special');

  const allConditions = [...stains, ...damages];

  const filteredConditions =
    filter === 'all'
      ? allConditions
      : filter === 'stain'
      ? stains
      : damages;

  const getLabel = (c: StainCondition) =>
    getBilingual(c.label, c.label2 ?? null) || c.label;

  const isSelected = (code: string) => selectedConditions.includes(code);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {!hideFilterBar && (
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} mb-4`}>
          <h3 className={`font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('customerOrderItemPiecesPreferences')}
          </h3>

          {/* Filter Buttons */}
          <div className={`flex gap-1 bg-gray-100 rounded-lg p-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('all')}
            </button>
            <button
              onClick={() => setFilter('stain')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === 'stain'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('stains')}
            </button>
            <button
              onClick={() => setFilter('damage')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === 'damage'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('damage')}
            </button>
          </div>
        </div>
      )}

      {/* Helper Text */}
      <p className={`text-xs text-gray-500 mb-3 ${isRTL ? 'text-right' : 'text-left'}`}>
        {disabled
          ? t('addItemFirst')
          : t('clickToApply')}
      </p>

      {/* Condition Toggles - flat tag cloud */}
      <div className={`flex flex-wrap gap-1.5 ${hideFilterBar ? '' : 'mt-2'}`}>
        {filteredConditions.map((condition) => {
          const selected = isSelected(condition.code);
          const categoryColor = selected
            ? condition.category === 'stain'
              ? 'bg-orange-500 text-white border-orange-600'
              : 'bg-red-500 text-white border-red-600'
            : disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-transparent'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-transparent';

          return (
            <button
              key={condition.code}
              onClick={() => !disabled && onConditionToggle(condition.code)}
              disabled={disabled}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${categoryColor}`}
            >
              {condition.icon && <span className={isRTL ? 'ms-1' : 'me-1'}>{condition.icon}</span>}
              {getLabel(condition)}
            </button>
          );
        })}
      </div>

      {/* Selected Conditions Summary */}
      {selectedConditions.length > 0 && (
        <div className={`mt-4 pt-4 border-t border-gray-200 ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className={`text-xs text-gray-600 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('appliedConditions')} ({selectedConditions.length}):
          </p>
          <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {selectedConditions.map((code) => {
              const condition = allConditions.find((c) => c.code === code);
              if (!condition) return null;

              return (
                <span
                  key={code}
                  className={`inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-md ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  {condition.icon && <span>{condition.icon}</span>}
                  {getLabel(condition)}
                  <button
                    onClick={() => onConditionToggle(code)}
                    className={`${isRTL ? 'mr-1' : 'ml-1'} hover:text-orange-900`}
                    aria-label={t('removeCondition')}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
