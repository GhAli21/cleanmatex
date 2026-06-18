'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';

/**
 *
 */
export function OrdersRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const tCommon = useTranslations('common');

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <CmxButton
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isPending}
      loading={isPending}
    >
      <RefreshCw className={`h-4 w-4 ltr:mr-2 rtl:ml-2 ${isPending ? 'animate-spin' : ''}`} />
      {tCommon('refresh')}
    </CmxButton>
  );
}
