/**
 * Processing Header Component
 * Top row with title, action button, and refresh icon
 */

'use client';

import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ProcessingHeaderProps {
  onRefresh: () => void | Promise<void>;
  isRefreshing?: boolean;
}

export function ProcessingHeader({ onRefresh, isRefreshing = false }: ProcessingHeaderProps) {
  const t = useTranslations('processing');
  const tOrders = useTranslations('orders');

  const handleRefresh = async () => {
    await onRefresh();
  };

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
          {tOrders('newOrder')}
        </Link>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={cn(
            "p-2 rounded-lg transition-colors",
            isRefreshing 
              ? "opacity-50 cursor-not-allowed" 
              : "hover:bg-gray-100"
          )}
          title={t('refresh')}
          aria-label={t('refresh')}
        >
          <RefreshCw 
            className={cn(
              "h-5 w-5 text-gray-600 transition-transform",
              isRefreshing && "animate-spin"
            )} 
          />
        </button>
      </div>
    </div>
  );
}
