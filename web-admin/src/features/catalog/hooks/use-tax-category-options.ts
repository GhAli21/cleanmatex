'use client';

import { useTranslations } from 'next-intl';
import { TAX_CATEGORIES } from '@/lib/constants/commercial';

/**
 * The tax category menu of a product (`sys_tax_category_cd`), in the screen's language.
 * @returns the options as `{ value, label }`
 * @example const options = useTaxCategoryOptions();
 */
export function useTaxCategoryOptions() {
  const t = useTranslations('catalog.taxCategory.options');
  return Object.values(TAX_CATEGORIES).map((value) => ({ value, label: t(value) }));
}
