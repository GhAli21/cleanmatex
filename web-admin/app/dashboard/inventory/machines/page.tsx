'use client';

import { useTranslations } from 'next-intl';
import { Boxes } from 'lucide-react';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';

/** Machines inventory — placeholder until machine registry UI ships. */
export default function InventoryMachinesPage() {
  const t = useTranslations('inventory');

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Boxes className="h-8 w-8 text-blue-600" aria-hidden />
        <h1 className="text-2xl font-bold text-gray-900">{t('machinesTitle')}</h1>
      </div>
      <CmxCard>
        <CmxCardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Boxes className="h-12 w-12 text-gray-400" aria-hidden />
          <p className="text-gray-600">{t('machinesComingSoon')}</p>
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
