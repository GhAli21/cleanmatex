/**
 * Processing Header Component
 * Top row with title, action button, and refresh icon
 */

'use client';

import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface ProcessingHeaderProps {
  onRefresh: () => void;
}

export function ProcessingHeader({ onRefresh }: ProcessingHeaderProps) {
  const t = useTranslations('processing');

  return (
    <div className="flex items-center justify-between">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 rtl:text-right">{t('title')}</h1>
        <p className="text-gray-600 mt-1 rtl:text-right">{t('subtitle')}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/orders/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          {t('updateOrder')}
        </Link>

        <button
          onClick={onRefresh}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title={t('refresh')}
          aria-label={t('refresh')}
        >
          <RefreshCw className="h-5 w-5 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
