'use client';

import { useState } from 'react';
import { Alert, AlertDescription, CmxButton, CmxInput, Label } from '@ui/primitives';
import { useTranslations, useLocale } from 'next-intl';
import { useWorkflowActions, type WorkflowActionDto } from '@/lib/hooks/use-workflow-actions';

const GATE_RACK_REQUIRED = 'GATE_RACK_REQUIRED';

export interface WorkflowActionBarProps {
  orderId: string;
  screen: string;
  /** Optional: hide when engine canary is off (default true). */
  hideWhenDisabled?: boolean;
  className?: string;
  onActionSuccess?: () => void;
}

function isOnlyRackBlocked(action: WorkflowActionDto): boolean {
  return (
    !action.enabled &&
    action.blockedReasons.length > 0 &&
    action.blockedReasons.every((r) => r.code === GATE_RACK_REQUIRED)
  );
}

function needsRackPrompt(actions: WorkflowActionDto[]): boolean {
  return actions.some((a) => a.blockedReasons.some((r) => r.code === GATE_RACK_REQUIRED));
}

/**
 * Floor action CTA bar driven by listAvailableActions / executeAction.
 * Shows enabled actions as primary buttons; disabled actions with blocked reasons.
 * When rack_required blocks an action, collects rack and passes it on execute.
 * No raw toStatus picker — action codes only (V1.0 UX contract).
 */
export function WorkflowActionBar({
  orderId,
  screen,
  hideWhenDisabled = true,
  className,
  onActionSuccess,
}: WorkflowActionBarProps) {
  const t = useTranslations('workflow.engine');
  const locale = useLocale();
  const { enabled, loading, actions, currentStatus, execute } = useWorkflowActions(
    orderId,
    screen,
  );
  const [rackLocation, setRackLocation] = useState('');
  const [rackError, setRackError] = useState<string | null>(null);

  if (!enabled && hideWhenDisabled) {
    return null;
  }

  if (!enabled) {
    return (
      <Alert variant="info" title={t('actionBarTitle')} className={className}>
        <AlertDescription>{t('canaryOff')}</AlertDescription>
      </Alert>
    );
  }

  const visible = actions.filter((a) => a.enabled || a.blockedReasons.length > 0);
  const showRackField = needsRackPrompt(actions);
  const rackTrimmed = rackLocation.trim();

  return (
    <section
      className={className ?? 'rounded-lg border border-border bg-card p-4 space-y-3'}
      aria-label={t('actionBarLabel')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{t('actionBarTitle')}</h2>
        {currentStatus ? (
          <span className="text-xs text-muted-foreground">
            {t('statusLabel', { status: currentStatus })}
          </span>
        ) : null}
      </div>

      {loading && visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : null}

      {!loading && visible.length === 0 ? (
        <Alert variant="info" title={t('noActionsTitle')}>
          <AlertDescription>{t('noActions')}</AlertDescription>
        </Alert>
      ) : null}

      {showRackField ? (
        <div className="space-y-1.5">
          <Label htmlFor={`wf-rack-${orderId}`}>{t('rackLocationLabel')}</Label>
          <CmxInput
            id={`wf-rack-${orderId}`}
            value={rackLocation}
            onChange={(e) => {
              setRackLocation(e.target.value);
              setRackError(null);
            }}
            placeholder={t('rackLocationPlaceholder')}
            autoComplete="off"
            aria-invalid={Boolean(rackError)}
            aria-describedby={rackError ? `wf-rack-err-${orderId}` : undefined}
          />
          <p className="text-xs text-muted-foreground">{t('rackLocationHelp')}</p>
          {rackError ? (
            <p id={`wf-rack-err-${orderId}`} className="text-xs text-destructive" role="alert">
              {rackError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {visible.map((action) => {
          const label =
            locale.startsWith('ar') && action.label2 ? action.label2 : action.label;
          const blockedHint = action.blockedReasons
            .map((r) => (locale.startsWith('ar') && r.message2 ? r.message2 : r.message))
            .join(' · ');
          const rackUnblocks = isOnlyRackBlocked(action) && rackTrimmed.length > 0;
          const canClick = (action.enabled || rackUnblocks) && !loading;

          return (
            <div
              key={`${action.actionCode}:${action.toStatus ?? ''}`}
              className="flex flex-col gap-1 min-w-[10rem] flex-1 sm:flex-none"
            >
              <CmxButton
                type="button"
                variant={canClick ? 'primary' : 'outline'}
                size="sm"
                className="w-full"
                disabled={!canClick}
                loading={loading}
                title={!canClick ? blockedHint : undefined}
                onClick={() => {
                  void (async () => {
                    if (isOnlyRackBlocked(action) && !rackTrimmed) {
                      setRackError(t('rackLocationRequired'));
                      return;
                    }
                    const ok = await execute(
                      action.actionCode,
                      rackTrimmed ? { rackLocation: rackTrimmed } : undefined,
                      action.toStatus,
                    );
                    if (ok) {
                      setRackLocation('');
                      setRackError(null);
                      onActionSuccess?.();
                    }
                  })();
                }}
              >
                {label}
              </CmxButton>
              {!canClick && blockedHint ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {blockedHint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
