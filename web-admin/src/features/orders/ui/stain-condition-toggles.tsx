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
import { cn } from '@/lib/utils';
import { isSafeMdiIconClass } from '@/lib/utils/mdi-icon';
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
      : STAIN_CONDITIONS.filter((c) => c.category === 'damage');

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
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      {!hideFilterBar && (
        <div className={`mb-4 flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
          <h3 className={`text-base font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('customerOrderItemPiecesPreferences')}
          </h3>

          {/* Filter Buttons */}
          <div className={`flex gap-1 rounded-lg bg-gray-100 p-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('all')}
            </button>
            <button
              type="button"
              onClick={() => setFilter('stain')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === 'stain'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('stains')}
            </button>
            <button
              type="button"
              onClick={() => setFilter('damage')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
      <p className={`mb-3 text-sm leading-relaxed text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
        {disabled ? t('addItemFirst') : t('clickToApply')}
      </p>

      {/* Condition chips — catalog icons use MDI webfont when safe */}
      <div className={`flex flex-wrap gap-2 ${hideFilterBar ? '' : 'mt-2'}`}>
        {filteredConditions.map((condition) => {
          const selected = isSelected(condition.code);
          const categoryColor = selected
            ? condition.category === 'stain'
              ? 'border-orange-600 bg-orange-500 text-white shadow-sm'
              : 'border-red-600 bg-red-500 text-white shadow-sm'
            : disabled
              ? 'cursor-not-allowed border-transparent bg-gray-100 text-gray-400'
              : 'border-gray-200 bg-gray-50 text-gray-800 hover:border-gray-300 hover:bg-white';

          const iconMuted = selected ? 'text-white' : disabled ? 'text-gray-400' : 'text-gray-600';

          return (
            <button
              key={condition.code}
              type="button"
              onClick={() => !disabled && onConditionToggle(condition.code)}
              disabled={disabled}
              className={cn(
                'inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border px-3.5 py-2 text-left text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
                categoryColor,
                isRTL && 'flex-row-reverse text-right'
              )}
            >
              {isSafeMdiIconClass(condition.icon) ? (
                <i
                  className={cn('mdi shrink-0 text-lg leading-none', condition.icon, iconMuted)}
                  aria-hidden="true"
                />
              ) : null}
              <span className="min-w-0 break-words">{getLabel(condition)}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Conditions Summary */}
      {selectedConditions.length > 0 && (
        <div className={`mt-5 border-t border-gray-200 pt-4 ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className={`mb-2 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('appliedConditions')} ({selectedConditions.length}):
          </p>
          <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {selectedConditions.map((code) => {
              const condition = allConditions.find((c) => c.code === code);
              if (!condition) return null;

              return (
                <span
                  key={code}
                  className={cn(
                    'inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-orange-900',
                    'bg-orange-100',
                    isRTL && 'flex-row-reverse'
                  )}
                >
                  {isSafeMdiIconClass(condition.icon) ? (
                    <i
                      className={cn('mdi shrink-0 text-base leading-none text-orange-800', condition.icon)}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="min-w-0 break-words">{getLabel(condition)}</span>
                  <button
                    type="button"
                    onClick={() => onConditionToggle(code)}
                    className={cn(
                      'shrink-0 rounded px-1.5 text-lg leading-none text-orange-800 hover:bg-orange-200/80 hover:text-orange-950',
                      isRTL ? 'me-0.5' : 'ms-0.5'
                    )}
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
