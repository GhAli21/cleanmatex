/**
 * Processing Modal Filters Component
 *
 * Filter bar for the processing modal.
 * Currently supports "Show Rejected On Top" filter.
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';

interface ProcessingModalFiltersProps {
  showRejectedOnTop: boolean;
  onToggleRejectedOnTop: (value: boolean) => void;
}

export function ProcessingModalFilters({
  showRejectedOnTop,
  onToggleRejectedOnTop,
}: ProcessingModalFiltersProps) {
  const t = useTranslations('processing.modal');

  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border">
      <Checkbox
        checked={showRejectedOnTop}
        onCheckedChange={onToggleRejectedOnTop}
        label={t('showRejectedOnTop')}
      />
    </div>
  );
}
