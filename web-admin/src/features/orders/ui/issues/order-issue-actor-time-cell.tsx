/**
 * Who + when cell for issue tables (created / solved).
 */

'use client';

import {
  formatIssueActorName,
  formatIssueDateTime,
} from './order-issue-table-types';

export interface OrderIssueActorTimeCellProps {
  /** Label above the actor name (e.g. "Created by") */
  byLabel: string;
  /** Label above the timestamp (e.g. "When") */
  whenLabel: string;
  actorName?: string | null;
  actorId?: string | null;
  at?: string | null;
  locale: string;
}

/**
 * Stacked actor + datetime with clear labels.
 */
export function OrderIssueActorTimeCell({
  byLabel,
  whenLabel,
  actorName,
  actorId,
  at,
  locale,
}: OrderIssueActorTimeCellProps) {
  return (
    <div className="min-w-[8.5rem] space-y-2 text-sm">
      <div className="space-y-0.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {byLabel}
        </div>
        <div className="font-medium text-foreground">
          {formatIssueActorName(actorName, actorId)}
        </div>
      </div>
      <div className="space-y-0.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {whenLabel}
        </div>
        <div className="text-foreground">{formatIssueDateTime(at, locale)}</div>
      </div>
    </div>
  );
}
