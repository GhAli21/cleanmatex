'use client';

import { useTranslations } from 'next-intl';
import { Truck } from 'lucide-react';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';

type DriversPlaceholderScreenProps = {
  titleKey: 'allDriversTitle' | 'routesTitle';
};

/**
 * Placeholder until dedicated driver management UI ships.
 */
export function DriversPlaceholderScreen({ titleKey }: DriversPlaceholderScreenProps) {
  const t = useTranslations('drivers');

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Truck className="h-8 w-8 text-blue-600" aria-hidden />
        <h1 className="text-2xl font-bold text-gray-900">{t(titleKey)}</h1>
      </div>
      <CmxCard>
        <CmxCardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Truck className="h-12 w-12 text-gray-400" aria-hidden />
          <p className="text-gray-600">{t('comingSoon')}</p>
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
