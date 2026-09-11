'use client';

import { ChevronRight } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { cn } from '@/lib/utils';

export interface WorkflowActionCommandProps {
  label: string;
  destinationLabel?: string | null;
  hint?: string | null;
  blockedHint?: string | null;
  canClick: boolean;
  loading: boolean;
  isPrimary: boolean;
  isStop: boolean;
  onClick: () => void;
}

/**
 * One floor workflow CTA. Primary commands show the destination on the
 * control itself so staff see the consequence before they press.
 */
export function WorkflowActionCommand({
  label,
  destinationLabel,
  hint,
  blockedHint,
  canClick,
  loading,
  isPrimary,
  isStop,
  onClick,
}: WorkflowActionCommandProps) {
  const statusText = !canClick ? blockedHint : hint;
  const accessibleName = [label, destinationLabel, statusText].filter(Boolean).join('. ');

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <CmxButton
        type="button"
        variant={isStop ? 'destructive' : isPrimary ? 'primary' : 'outline'}
        size={isPrimary || isStop ? 'lg' : 'md'}
        disabled={!canClick}
        loading={loading}
        title={!canClick ? blockedHint ?? undefined : hint ?? undefined}
        aria-label={accessibleName}
        onClick={onClick}
        className="w-full gap-3"
      >
        <span className="inline-flex min-w-0 items-center gap-2 text-start">
          <span className="min-w-0 whitespace-normal">{label}</span>
          {canClick ? (
            <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
          ) : null}
        </span>
        {destinationLabel ? (
          <span
            className={cn(
              'ms-auto max-w-[50%] shrink-0 truncate text-xs font-medium',
              isPrimary || isStop ? 'opacity-90' : 'text-muted-foreground',
            )}
            title={destinationLabel}
          >
            {destinationLabel}
          </span>
        ) : null}
      </CmxButton>
      {statusText ? (
        <p className="text-xs text-muted-foreground" role="status">
          {statusText}
        </p>
      ) : null}
    </div>
  );
}
