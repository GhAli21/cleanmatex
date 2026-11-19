/**
 * Stain/Condition Toggles Component
 * Toggle buttons for item conditions, repairs, or stains
 * Re-Design: PRD-010 Advanced Orders - Section 3C
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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

/**
 *
 * @param root0
 * @param root0.selectedConditions
 * @param root0.onConditionToggle
 * @param root0.disabled
 * @param root0.defaultFilter
 * @param root0.hideFilterBar
 * @param root0.stainCatalog
 * @param root0.damageCatalog
 */
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
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      {!hideFilterBar && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground text-start">
            {t('customerOrderItemPiecesPreferences')}
          </h3>

          {/* Filter Buttons */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('all')}
            </button>
            <button
              type="button"
              onClick={() => setFilter('stain')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === 'stain'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('stains')}
            </button>
            <button
              type="button"
              onClick={() => setFilter('damage')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === 'damage'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('damage')}
            </button>
          </div>
        </div>
      )}

      {/* Helper Text */}
      <p className="mb-3 text-sm leading-relaxed text-muted-foreground text-start">
        {disabled ? t('addItemFirst') : t('clickToApply')}
      </p>

      {/* Condition chips — catalog icons use MDI webfont when safe */}
      <div className={`flex flex-wrap gap-2 ${hideFilterBar ? '' : 'mt-2'}`}>
        {filteredConditions.map((condition) => {
          const selected = isSelected(condition.code);
          const categoryColor = selected
            ? condition.category === 'stain'
              ? 'border-warning bg-warning text-warning-foreground shadow-sm'
              : 'border-destructive bg-destructive text-destructive-foreground shadow-sm'
            : disabled
              ? 'cursor-not-allowed border-transparent bg-muted text-muted-foreground'
              : 'border-border bg-muted text-foreground hover:border-muted-foreground hover:bg-card';

          const iconMuted = selected ? 'text-on-solid' : disabled ? 'text-muted-foreground' : 'text-muted-foreground';

          return (
            <button
              key={condition.code}
              type="button"
              onClick={() => !disabled && onConditionToggle(condition.code)}
              disabled={disabled}
              className={cn(
                'inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border px-3.5 py-2 text-start text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                categoryColor,
                false
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
        <div className="mt-5 border-t border-border pt-4 text-start">
          <p className="mb-2 text-sm font-medium text-foreground text-start">
            {t('appliedConditions')} ({selectedConditions.length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedConditions.map((code) => {
              const condition = allConditions.find((c) => c.code === code);
              if (!condition) return null;

              return (
                <span
                  key={code}
                  className={cn(
                    'inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-warning-text',
                    'bg-warning-bg',
                    false
                  )}
                >
                  {isSafeMdiIconClass(condition.icon) ? (
                    <i
                      className={cn('mdi shrink-0 text-base leading-none text-warning-text', condition.icon)}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="min-w-0 break-words">{getLabel(condition)}</span>
                  <button
                    type="button"
                    onClick={() => onConditionToggle(code)}
                    className={cn(
                      'shrink-0 rounded px-1.5 text-lg leading-none text-warning-text hover:bg-warning-border/80 hover:text-warning-text/80',
                      'ms-0.5'
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
