"use client";

import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives';

interface PresetButtonsProps {
  productCatalog: Array<{ id: string; name: string; serviceCategory: string; price: number }>;
  disabled?: boolean;
  onAddPreset: (
    items: Array<{ productId: string; serviceCategoryCode: string; quantity: number }>
  ) => Promise<void> | void;
}

/**
 * Quick-add presets for common garment quantities during preparation.
 */
export function PresetButtons({ productCatalog, disabled, onAddPreset }: PresetButtonsProps) {
  const t = useTranslations('workflow.preparation.presets');

  const shirt = productCatalog.find((p) => /shirt/i.test(p.name)) || productCatalog[0];
  const pants = productCatalog.find((p) => /pant/i.test(p.name)) || productCatalog[0];

  if (!shirt && !pants) {
    return (
      <p className="text-sm text-gray-500" role="status">
        {t('noCatalog')}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {shirt && (
        <CmxButton
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !shirt.id}
          onClick={() =>
            void onAddPreset([
              {
                productId: shirt.id,
                serviceCategoryCode: shirt.serviceCategory,
                quantity: 5,
              },
            ])
          }
        >
          {t('addShirts', { count: 5 })}
        </CmxButton>
      )}
      {pants && (
        <CmxButton
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !pants.id}
          onClick={() =>
            void onAddPreset([
              {
                productId: pants.id,
                serviceCategoryCode: pants.serviceCategory,
                quantity: 2,
              },
            ])
          }
        >
          {t('addPants', { count: 2 })}
        </CmxButton>
      )}
    </div>
  );
}
