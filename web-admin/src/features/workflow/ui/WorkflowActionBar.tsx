'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, CmxButton, CmxInput, Label } from '@ui/primitives';
import { CmxEmptyState } from '@ui/data-display';
import { cmxMessage } from '@ui/feedback';
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
  /**
   * When the engine returns no actions for this screen (wrong stage / not a member),
   * navigate here (e.g. list `returnUrl` or `/dashboard/preparation`).
   */
  emptyBackHref?: string;
  /**
   * Floor content under the action bar. Hidden when there are no actions
   * (avoids editing an order that does not belong on this screen).
   */
  children?: ReactNode;
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
 * When no actions: redirect via emptyBackHref, else CmxEmptyState (and hide children).
 */
export function WorkflowActionBar({
  orderId,
  screen,
  hideWhenDisabled = true,
  className,
  onActionSuccess,
  emptyBackHref,
  children,
}: WorkflowActionBarProps) {
  const t = useTranslations('workflow.engine');
  const locale = useLocale();
  const router = useRouter();
  const { enabled, loading, actions, currentStatus, execute } = useWorkflowActions(
    orderId,
    screen,
  );
  const [rackLocation, setRackLocation] = useState('');
  const [rackError, setRackError] = useState<string | null>(null);
  const didRedirectRef = useRef(false);

  const visible = actions.filter((a) => a.enabled || a.blockedReasons.length > 0);
  const isEmpty = enabled && !loading && visible.length === 0;

  useEffect(() => {
    if (!isEmpty || !emptyBackHref || didRedirectRef.current) return;
    didRedirectRef.current = true;
    cmxMessage.info(t('redirectedNoActions'));
    router.replace(emptyBackHref);
  }, [isEmpty, emptyBackHref, router, t]);

  if (!enabled && hideWhenDisabled) {
    return children ? <>{children}</> : null;
  }

  if (!enabled) {
    return (
      <>
        <Alert variant="info" title={t('actionBarTitle')} className={className}>
          <AlertDescription>{t('canaryOff')}</AlertDescription>
        </Alert>
        {children}
      </>
    );
  }

  if (loading && visible.length === 0) {
    return (
      <section
        className={className ?? 'rounded-lg border border-border bg-card p-4 space-y-3'}
        aria-label={t('actionBarLabel')}
      >
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      </section>
    );
  }

  if (isEmpty) {
    if (emptyBackHref) {
      // Redirect in flight — avoid flashing floor tools for the wrong stage.
      return (
        <p className="text-sm text-muted-foreground" role="status">
          {t('redirecting')}
        </p>
      );
    }

    return (
      <CmxEmptyState
        title={t('emptyScreenTitle')}
        description={
          currentStatus
            ? t('emptyScreenBodyWithStatus', { status: currentStatus })
            : t('emptyScreenBody')
        }
      />
    );
  }

  const showRackField = needsRackPrompt(actions);
  const rackTrimmed = rackLocation.trim();

  return (
    <>
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
      {children}
    </>
  );
}
