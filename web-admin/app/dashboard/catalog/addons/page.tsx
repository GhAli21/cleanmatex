/**
 * Catalog Add-ons Page
 * Placeholder for add-ons / tags management (linked from navigation).
 * Route: /dashboard/catalog/addons
 */

'use client';

import { useTranslations } from 'next-intl';
import { CmxCard } from '@ui/primitives/cmx-card';
import { Tag } from 'lucide-react';

export default function CatalogAddonsPage() {
  const t = useTranslations('catalog');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('addons')}</h1>
      </div>

      <CmxCard className="flex flex-col items-center justify-center p-12">
        <Tag className="mb-4 h-12 w-12 text-gray-400" aria-hidden />
        <p className="text-center text-gray-600">
          {t('addonsComingSoon')}
        </p>
      </CmxCard>
    </div>
  );
}
