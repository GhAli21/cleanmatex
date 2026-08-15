'use client';

import { PackageCheck, PackageOpen } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { CmxStatusBadge } from '@ui/feedback';
import {
  PICKUP_RELEASE_STATES,
  type PickupReleaseSummary,
} from '@/lib/types/pickup-release';

export interface PickupReleaseStatusProps {
  release: PickupReleaseSummary;
  /** Canonical order status; retained alongside release data during migration rollout. */
  workflowStatus?: string | null;
  showTimestamp?: boolean;
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
}: PickupReleaseStatusProps) {
  const t = useTranslations('workflow.ready.pickupRelease');
  const locale = useLocale();
  const isAvailable =
    workflowStatus?.trim().toLowerCase() === 'ready_for_pickup' ||
    release.state === PICKUP_RELEASE_STATES.AVAILABLE_FOR_PICKUP;
  const label = isAvailable ? t('available') : t('notReleased');
  const formattedReleasedAt =
    showTimestamp && release.releasedAt
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(release.releasedAt),
        )
      : null;

  return (
    <div className="space-y-1">
      <CmxStatusBadge
        label={label}
        variant={isAvailable ? 'success' : 'outline'}
        size="sm"
        icon={isAvailable ? PackageCheck : PackageOpen}
        showIcon
      />
      {formattedReleasedAt ? (
        <p className="text-xs text-muted-foreground">
          {t('availableSince', { date: formattedReleasedAt })}
        </p>
      ) : null}
    </div>
  );
}
