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

/**
 *
 * @param root0
 * @param root0.onRefresh
 * @param root0.isRefreshing
 */
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
        <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/orders/new"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover font-medium transition-colors"
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
              : "hover:bg-muted"
          )}
          title={t('refresh')}
          aria-label={t('refresh')}
        >
          <RefreshCw 
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              isRefreshing && "animate-spin"
            )} 
          />
        </button>
      </div>
    </div>
  );
}
