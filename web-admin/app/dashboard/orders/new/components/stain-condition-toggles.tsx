/**
 * Stain/Condition Toggles Component
 * Toggle buttons for item conditions, repairs, or stains
 * Re-Design: PRD-010 Advanced Orders - Section 3C
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { STAIN_CONDITIONS, StainCondition } from '@/lib/types/order-creation';

interface StainConditionTogglesProps {
  selectedConditions: string[];
  onConditionToggle: (conditionCode: string) => void;
  disabled?: boolean;
}

export function StainConditionToggles({
  selectedConditions,
  onConditionToggle,
  disabled = false,
}: StainConditionTogglesProps) {
  const t = useTranslations('newOrder.notesPalette');
  const isRTL = useRTL();
  const [filter, setFilter] = useState<'all' | 'stain' | 'damage' | 'special'>('all');

  const filteredConditions = filter === 'all'
    ? STAIN_CONDITIONS
    : STAIN_CONDITIONS.filter((c) => c.category === filter);

  const isSelected = (code: string) => selectedConditions.includes(code);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} mb-4`}>
        <h3 className={`font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('itemConditionsStains')}
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
          <button
            onClick={() => setFilter('special')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              filter === 'special'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('special')}
          </button>
        </div>
      </div>

      {/* Helper Text */}
      <p className={`text-xs text-gray-500 mb-3 ${isRTL ? 'text-right' : 'text-left'}`}>
        {disabled
          ? t('addItemFirst')
          : t('clickToApply')}
      </p>

      {/* Condition Toggles Grid - 2-3 rows, scrollable */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-32 overflow-y-auto">
        {filteredConditions.map((condition) => {
          const selected = isSelected(condition.code);

          return (
            <button
              key={condition.code}
              onClick={() => !disabled && onConditionToggle(condition.code)}
              disabled={disabled}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium transition-all
                min-h-[44px] flex items-center justify-center text-center
                ${
                  selected
                    ? 'bg-orange-500 text-white shadow-md border-2 border-orange-600'
                    : disabled
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm border-2 border-transparent'
                }
              `}
            >
              {condition.icon && <span className={isRTL ? 'ml-1' : 'mr-1'}>{condition.icon}</span>}
              {condition.label}
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
              const condition = STAIN_CONDITIONS.find((c) => c.code === code);
              if (!condition) return null;

              return (
                <span
                  key={code}
                  className={`inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-md ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  {condition.icon && <span>{condition.icon}</span>}
                  {condition.label}
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
