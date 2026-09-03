'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, CmxButton, CmxInput } from '@ui/primitives';
import { CmxEmptyState } from '@ui/data-display';
import { CmxConfirmDialog, cmxMessage } from '@ui/feedback';
import { CmxFieldShell, cmxFocusField } from '@ui/forms';
import { useTranslations, useLocale } from 'next-intl';
import {
  toSubmittedGateDecisions,
  useWorkflowActions,
  type WorkflowActionDto,
  type WorkflowGateDecisionDto,
} from '@/lib/hooks/use-workflow-actions';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { workflowActionBarEmptyMode } from '@features/workflow/ui/workflow-action-bar-empty';

const GATE_RACK_REQUIRED = 'GATE_RACK_REQUIRED';

const MIN_CONTROL_NOTES = 10;
/** Actions whose policy requires an audit reason/note (must stay aligned with workflow profile seeds). */
const CONTROL_ACTIONS_NEEDING_NOTES = new Set<string>([
  WORKFLOW_ACTIONS.HOLD_ORDER_WORK,
  WORKFLOW_ACTIONS.RESUME_ORDER_WORK,
  WORKFLOW_ACTIONS.STOP_ORDER_WORK,
  WORKFLOW_ACTIONS.FAIL_QA,
]);

const WF_FIELD_NAMES = {
  rackLocation: 'wf-rack-location',
  controlNotes: 'wf-control-notes',
  overrideReason: 'wf-override-reason',
} as const;

function actionNeedsControlNotes(actionCode: string): boolean {
  return CONTROL_ACTIONS_NEEDING_NOTES.has(actionCode);
}

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
   * Hidden leave-actions do not count as empty — bounce only on a true engine miss.
   */
  emptyBackHref?: string;
  /**
   * Floor content under the action bar. Hidden when there are no actions
   * (avoids editing an order that does not belong on this screen).
   */
  children?: ReactNode;
  /** Optional title override (e.g. hold/resume/stop). */
  title?: string;
  /** Action codes already represented by a stage-specific completion surface. */
  hiddenActionCodes?: readonly string[];
  /**
   * Stage-owned commands rendered beside configured workflow actions while
   * retaining their own service/API boundary.
   */
  supplementalActions?: ReactNode;
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

function gateDecisionsFor(action: WorkflowActionDto): WorkflowGateDecisionDto[] {
  return action.gateDecisions ?? [];
}

function overrideMinReasonLength(decisions: WorkflowGateDecisionDto[]): number {
  return Math.max(
    MIN_CONTROL_NOTES,
    ...decisions
      .filter((decision) => decision.result === 'OVERRIDABLE')
      .map((decision) => decision.overrideMinReasonLength ?? MIN_CONTROL_NOTES),
  );
}

/**
 * Floor action CTA bar driven by listAvailableActions / executeAction.
 * Shows enabled actions as primary buttons; disabled actions with blocked reasons.
 * When rack_required blocks an action, collects rack and passes it on execute.
 * When no actions: redirect via emptyBackHref, else CmxEmptyState. A stage-owned
 * supplemental command keeps the action panel available without becoming a raw
 * workflow-status write.
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
  hiddenActionCodes = [],
  supplementalActions,
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
  const [pendingGateAction, setPendingGateAction] = useState<WorkflowActionDto | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideReasonError, setOverrideReasonError] = useState<string | null>(null);
  const didRedirectRef = useRef(false);
  const rackInputRef = useRef<HTMLInputElement>(null);
  const controlNotesInputRef = useRef<HTMLInputElement>(null);
  const overrideReasonInputRef = useRef<HTMLInputElement>(null);

  const failField = (
    field: (typeof WF_FIELD_NAMES)[keyof typeof WF_FIELD_NAMES],
    message: string,
    inputRef: RefObject<HTMLInputElement | null>,
    setError: (value: string | null) => void,
  ) => {
    setError(message);
    cmxFocusField({
      name: field,
      id: inputRef.current?.id,
      element: inputRef.current,
    });
  };

  const visible = actions.filter(
    (action) =>
      !hiddenActionCodes.includes(action.actionCode) &&
      (action.enabled || action.blockedReasons.length > 0),
  );
  const hasSupplementalActions = supplementalActions != null;
  // Wait for first fetch — initial [] must not count as empty (false bounce).
  const emptyMode =
    enabled && hasLoaded && !loading
      ? workflowActionBarEmptyMode({
          visibleCount: visible.length,
          engineActionCount: actions.length,
          hasSupplementalActions,
          hideWhenEmpty,
          hasEmptyBackHref: Boolean(emptyBackHref),
        })
      : 'ready';
  const needsControlNotes = visible.some((a) => actionNeedsControlNotes(a.actionCode));

  useEffect(() => {
    if (emptyMode !== 'redirect' || !emptyBackHref || didRedirectRef.current) return;
    didRedirectRef.current = true;
    cmxMessage.info(t('redirectedNoActions'));
    router.replace(emptyBackHref);
  }, [emptyMode, emptyBackHref, router, t]);

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

  if (emptyMode === 'hide') {
    return children ? <>{children}</> : null;
  }

  if (emptyMode === 'redirect') {
    // Redirect in flight — avoid flashing floor tools for the wrong stage.
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t('redirecting')}
      </p>
    );
  }

  if (emptyMode === 'empty') {
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

  const executeWorkflowAction = async (
    action: WorkflowActionDto,
    submittedGateDecisions?: ReturnType<typeof toSubmittedGateDecisions>,
  ) => {
    const input: Record<string, unknown> = {};
    if (rackTrimmed) input.rackLocation = rackTrimmed;
    if (actionNeedsControlNotes(action.actionCode)) {
      input.notes = notesTrimmed;
      input.reason = notesTrimmed;
    }
    const ok = await execute(
      action.actionCode,
      Object.keys(input).length > 0 ? input : undefined,
      action.toStatus,
      submittedGateDecisions,
    );
    if (ok) {
      setRackLocation('');
      setRackError(null);
      setControlNotes('');
      setControlNotesError(null);
      setPendingGateAction(null);
      setOverrideReason('');
      setOverrideReasonError(null);
      onActionSuccess?.();
    }
  };

  const requestWorkflowAction = async (action: WorkflowActionDto) => {
    if (gateDecisionsFor(action).length > 0) {
      setPendingGateAction(action);
      setOverrideReason('');
      setOverrideReasonError(null);
      return;
    }
    await executeWorkflowAction(action);
  };

  const pendingGateDecisions = pendingGateAction ? gateDecisionsFor(pendingGateAction) : [];
  const pendingNeedsOverride = pendingGateDecisions.some((decision) => decision.result === 'OVERRIDABLE');
  const pendingNeedsWarning = pendingGateDecisions.some((decision) => decision.result === 'WARNING');
  const pendingOverrideMin = overrideMinReasonLength(pendingGateDecisions);
  const pendingOverridePermission = pendingGateDecisions.find(
    (decision) => decision.result === 'OVERRIDABLE' && decision.overridePermissionCode,
  )?.overridePermissionCode;

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
          <CmxFieldShell
            id={`wf-rack-${orderId}`}
            name={WF_FIELD_NAMES.rackLocation}
            label={t('rackLocationLabel')}
            hint={t('rackLocationHelp')}
            error={rackError}
            required
          >
            <CmxInput
              ref={rackInputRef}
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
          </CmxFieldShell>
        ) : null}

        {needsControlNotes ? (
          <CmxFieldShell
            id={`wf-control-notes-${orderId}`}
            name={WF_FIELD_NAMES.controlNotes}
            label={t('controlNotesLabel')}
            hint={t('controlNotesHelp', { min: MIN_CONTROL_NOTES })}
            error={controlNotesError}
            required
          >
            <CmxInput
              ref={controlNotesInputRef}
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
          </CmxFieldShell>
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
                        failField(
                          WF_FIELD_NAMES.rackLocation,
                          t('rackLocationRequired'),
                          rackInputRef,
                          setRackError,
                        );
                        return;
                      }
                      if (
                        actionNeedsControlNotes(action.actionCode) &&
                        notesTrimmed.length < MIN_CONTROL_NOTES
                      ) {
                        failField(
                          WF_FIELD_NAMES.controlNotes,
                          t('controlNotesRequired', { min: MIN_CONTROL_NOTES }),
                          controlNotesInputRef,
                          setControlNotesError,
                        );
                        return;
                      }
                      if (action.actionCode === WORKFLOW_ACTIONS.STOP_ORDER_WORK) {
                        setPendingStopAction(action);
                        return;
                      }
                      await requestWorkflowAction(action);
                    })();
                  }}
                >
                  {label}
                </CmxButton>
                {canClick && gateDecisionsFor(action).length > 0 ? (
                  <p className="text-xs text-muted-foreground" role="status">
                    {gateDecisionsFor(action).some((decision) => decision.result === 'OVERRIDABLE')
                      ? t('gateOverrideHint')
                      : t('gateWarningHint')}
                  </p>
                ) : null}
                {!canClick && blockedHint ? (
                  <p className="text-xs text-muted-foreground" role="status">
                    {blockedHint}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        {hasSupplementalActions ? (
          <div className="border-t border-border pt-3">{supplementalActions}</div>
        ) : null}
      </section>
      <CmxConfirmDialog
        open={pendingStopAction !== null}
        title={t('stopConfirmTitle')}
        description={t('stopConfirmDescription')}
        confirmLabel={t('stopConfirmAction')}
        cancelLabel={tCommon('cancel')}
        onConfirm={async () => {
          if (pendingStopAction) {
            await requestWorkflowAction(pendingStopAction);
          }
        }}
        onCancel={() => setPendingStopAction(null)}
      />
      <CmxConfirmDialog
        open={pendingGateAction !== null}
        title={pendingNeedsOverride ? t('gateOverrideTitle') : t('gateWarningTitle')}
        description={
          pendingNeedsOverride
            ? t('gateOverrideDescription')
            : t('gateWarningDescription')
        }
        confirmLabel={t('gateConfirmAction')}
        cancelLabel={tCommon('cancel')}
        confirmDisabled={pendingNeedsOverride && overrideReason.trim().length < pendingOverrideMin}
        onConfirm={async () => {
          if (!pendingGateAction) return;
          if (pendingNeedsOverride && overrideReason.trim().length < pendingOverrideMin) {
            failField(
              WF_FIELD_NAMES.overrideReason,
              t('gateOverrideReasonRequired', { min: pendingOverrideMin }),
              overrideReasonInputRef,
              setOverrideReasonError,
            );
            return;
          }
          await executeWorkflowAction(
            pendingGateAction,
            toSubmittedGateDecisions(pendingGateDecisions, overrideReason.trim()),
          );
        }}
        onCancel={() => {
          setPendingGateAction(null);
          setOverrideReason('');
          setOverrideReasonError(null);
        }}
      >
        {pendingNeedsWarning ? (
          <p className="text-xs text-muted-foreground">{t('gateAckHint')}</p>
        ) : null}
        {pendingGateDecisions.map((decision) => (
          <p key={decision.gateCode} className="text-xs text-foreground">
            {decision.messageKey?.trim() || decision.gateCode}
          </p>
        ))}
        {pendingNeedsOverride ? (
          <CmxFieldShell
            id={`wf-override-reason-${orderId}`}
            name={WF_FIELD_NAMES.overrideReason}
            label={t('gateOverrideReasonLabel')}
            hint={
              pendingOverridePermission
                ? t('gateOverridePermissionHint', { permission: pendingOverridePermission })
                : undefined
            }
            error={overrideReasonError}
            required
          >
            <CmxInput
              ref={overrideReasonInputRef}
              id={`wf-override-reason-${orderId}`}
              value={overrideReason}
              onChange={(event) => {
                setOverrideReason(event.target.value);
                setOverrideReasonError(null);
              }}
              placeholder={t('gateOverrideReasonPlaceholder')}
              autoComplete="off"
              aria-invalid={Boolean(overrideReasonError)}
              aria-describedby={
                overrideReasonError ? `wf-override-reason-err-${orderId}` : undefined
              }
            />
          </CmxFieldShell>
        ) : null}
      </CmxConfirmDialog>
      {children}
    </>
  );
}
