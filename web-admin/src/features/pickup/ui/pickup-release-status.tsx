'use client';

import { PackageCheck, PackageOpen } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { CmxStatusBadge } from '@ui/feedback';
import {
  PICKUP_RELEASE_STATES,
  type PickupReleaseSummary,
} from '@/lib/types/pickup-release';
import { formatInstantOrEmpty } from '@/lib/utils/operational-time';

export interface PickupReleaseStatusProps {
  release: PickupReleaseSummary;
  /** Canonical order status; retained alongside release data during migration rollout. */
  workflowStatus?: string | null;
  showTimestamp?: boolean;
  opsZone?: string | null;
}

/**
 * Displays the counter-pickup workflow state with its release timestamp.
 *
 * Reusing this component keeps cards, detail views, and later mobile surfaces
 * aligned with the canonical `ready_for_pickup` status while still rendering
 * pre-migration release data correctly during rollout.
 */
export function PickupReleaseStatus({
  release,
  workflowStatus,
  showTimestamp = false,
  opsZone = null,
}: PickupReleaseStatusProps) {
  const t = useTranslations('workflow.ready.pickupRelease');
  const locale = useLocale();
  const isAvailable =
    workflowStatus?.trim().toLowerCase() === 'ready_for_pickup' ||
    release.state === PICKUP_RELEASE_STATES.AVAILABLE_FOR_PICKUP;
  const label = isAvailable ? t('available') : t('notReleased');
  const formattedReleasedAt =
    showTimestamp && release.releasedAt
      ? formatInstantOrEmpty(release.releasedAt, opsZone, locale) || null
      : null;

  return (
    <div className="space-y-1">
      <CmxStatusBadge
        label={label}
        tone={isAvailable ? 'success' : 'neutral'}
        size="sm"
        icon={isAvailable ? PackageCheck : PackageOpen}
      />
      {formattedReleasedAt ? (
        <p className="text-xs text-muted-foreground">
          {t('availableSince', { date: formattedReleasedAt })}
        </p>
      ) : null}
    </div>
  );
}
