'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';

interface TaxItemClass {
  class_code: string;
  name: string;
  name2: string | null;
  is_default: boolean;
}

/**
 * The sales tax classes of the organization as select options. The empty option means
 * "use the organization's default class".
 * @returns the options as `{ value, label }`, scoped to the signed-in organization
 * @example const options = useTaxItemClassOptions();
 */
export function useTaxItemClassOptions() {
  const t = useTranslations('catalog.taxItemClass');
  const isArabic = useLocale() === 'ar';
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const { data } = useQuery({
    queryKey: ['catalog', tenantId, 'tax-classes'],
    queryFn: async ({ signal }): Promise<TaxItemClass[]> => {
      const res = await fetch('/api/v1/products/tax-classes', { signal });
      if (!res.ok) throw new Error('tax classes');
      return (await res.json()).data;
    },
    // Prevent query before tenant is confirmed
    enabled: !!tenantId,
  });
  return [
    { value: '', label: t('useDefault') },
    ...(data ?? []).map((c) => ({ value: c.class_code, label: (isArabic && c.name2) || c.name })),
  ];
}
