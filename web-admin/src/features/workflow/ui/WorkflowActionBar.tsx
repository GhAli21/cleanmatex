'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, CmxButton, CmxInput, Label } from '@ui/primitives';
import { CmxEmptyState } from '@ui/data-display';
import { CmxConfirmDialog, cmxMessage } from '@ui/feedback';
import { useTranslations, useLocale } from 'next-intl';
import { useWorkflowActions, type WorkflowActionDto } from '@/lib/hooks/use-workflow-actions';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

const GATE_RACK_REQUIRED = 'GATE_RACK_REQUIRED';

const MIN_CONTROL_NOTES = 10;
const CONTROL_ACTIONS_NEEDING_NOTES = new Set<string>([
  WORKFLOW_ACTIONS.HOLD_ORDER_WORK,
  WORKFLOW_ACTIONS.STOP_ORDER_WORK,
]);

export interface WorkflowActionBarProps {
  orderId: string;
  screen: string;
  /** Optional: hide when engine canary is off (default true). */
  hideWhenDisabled?: boolean;
  /**
   * When true and there are no visible actions, render nothing (no empty state).
   * Useful for secondary bars like order_control on order detail.
   */
  hideWhenEmpty?: boolean;
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
  /** Optional title override (e.g. hold/resume/stop). */
  title?: string;
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
  hideWhenEmpty = false,
  className,
  onActionSuccess,
  emptyBackHref,
  children,
  title,
}: WorkflowActionBarProps) {
  const t = useTranslations('workflow.engine');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { enabled, loading, hasLoaded, actions, currentStatus, execute } =
    useWorkflowActions(orderId, screen);
  const [rackLocation, setRackLocation] = useState('');
  const [rackError, setRackError] = useState<string | null>(null);
  const [controlNotes, setControlNotes] = useState('');
  const [controlNotesError, setControlNotesError] = useState<string | null>(null);
  const [pendingStopAction, setPendingStopAction] = useState<WorkflowActionDto | null>(null);
  const didRedirectRef = useRef(false);

  const visible = actions.filter((a) => a.enabled || a.blockedReasons.length > 0);
  // Wait for first fetch — initial [] must not count as empty (false bounce).
  const isEmpty = enabled && hasLoaded && !loading && visible.length === 0;
  const needsControlNotes = visible.some((a) =>
    CONTROL_ACTIONS_NEEDING_NOTES.has(a.actionCode),
  );

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

  // Keep floor children mounted while actions load — preparation itemizer etc.
  // must not disappear behind a loading-only shell.
  if (loading && visible.length === 0) {
    return (
      <>
        <section
          className={className ?? 'rounded-lg border border-border bg-card p-4 space-y-3'}
          aria-label={t('actionBarLabel')}
        >
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </section>
        {children}
      </>
    );
  }

  if (isEmpty) {
    if (hideWhenEmpty) {
      return children ? <>{children}</> : null;
    }
    if (emptyBackHref) {
      // Redirect in flight — avoid flashing floor tools for the wrong stage.
      return (
        <p className="text-sm text-muted-foreground" role="status">
          {t('redirecting')}
        </p>
      );
    }

    return (
      <>
        <CmxEmptyState
          title={t('emptyScreenTitle')}
          description={
            currentStatus
              ? t('emptyScreenBodyWithStatus', { status: currentStatus })
              : t('emptyScreenBody')
          }
        />
        {children}
      </>
    );
  }

  const showRackField = needsRackPrompt(actions);
  const rackTrimmed = rackLocation.trim();
  const notesTrimmed = controlNotes.trim();

  const executeWorkflowAction = async (action: WorkflowActionDto) => {
    const input: Record<string, unknown> = {};
    if (rackTrimmed) input.rackLocation = rackTrimmed;
    if (CONTROL_ACTIONS_NEEDING_NOTES.has(action.actionCode)) {
      input.notes = notesTrimmed;
    }
    const ok = await execute(
      action.actionCode,
      Object.keys(input).length > 0 ? input : undefined,
      action.toStatus,
    );
    if (ok) {
      setRackLocation('');
      setRackError(null);
      setControlNotes('');
      setControlNotesError(null);
      onActionSuccess?.();
    }
  };

  return (
    <>
      <section
        className={className ?? 'rounded-lg border border-border bg-card p-4 space-y-3'}
        aria-label={t('actionBarLabel')}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {title ?? t('actionBarTitle')}
          </h2>
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

        {needsControlNotes ? (
          <div className="space-y-1.5">
            <Label htmlFor={`wf-control-notes-${orderId}`}>{t('controlNotesLabel')}</Label>
            <CmxInput
              id={`wf-control-notes-${orderId}`}
              value={controlNotes}
              onChange={(e) => {
                setControlNotes(e.target.value);
                setControlNotesError(null);
              }}
              placeholder={t('controlNotesPlaceholder')}
              autoComplete="off"
              aria-invalid={Boolean(controlNotesError)}
              aria-describedby={
                controlNotesError ? `wf-control-notes-err-${orderId}` : undefined
              }
            />
            <p className="text-xs text-muted-foreground">
              {t('controlNotesHelp', { min: MIN_CONTROL_NOTES })}
            </p>
            {controlNotesError ? (
              <p
                id={`wf-control-notes-err-${orderId}`}
                className="text-xs text-destructive"
                role="alert"
              >
                {controlNotesError}
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
                      const needsNotes = CONTROL_ACTIONS_NEEDING_NOTES.has(action.actionCode);
                      if (needsNotes && notesTrimmed.length < MIN_CONTROL_NOTES) {
                        setControlNotesError(
                          t('controlNotesRequired', { min: MIN_CONTROL_NOTES }),
                        );
                        return;
                      }
                      if (action.actionCode === WORKFLOW_ACTIONS.STOP_ORDER_WORK) {
                        setPendingStopAction(action);
                        return;
                      }
                      await executeWorkflowAction(action);
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
      <CmxConfirmDialog
        open={pendingStopAction !== null}
        title={t('stopConfirmTitle')}
        description={t('stopConfirmDescription')}
        confirmLabel={t('stopConfirmAction')}
        cancelLabel={tCommon('cancel')}
        onConfirm={async () => {
          if (pendingStopAction) {
            await executeWorkflowAction(pendingStopAction);
          }
        }}
        onCancel={() => setPendingStopAction(null)}
      />
      {children}
    </>
  );
}
