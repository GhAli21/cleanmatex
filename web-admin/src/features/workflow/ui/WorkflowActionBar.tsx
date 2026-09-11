'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, CmxCard, CmxCardTitle, CmxInput, CmxSkeleton } from '@ui/primitives';
import { CmxEmptyState } from '@ui/data-display';
import { CmxConfirmDialog, CmxStatusBadge, CmxSummaryMessage, cmxMessage } from '@ui/feedback';
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
import { isOnlyRackBlocked } from '@features/workflow/lib/rack-gate-helpers';
import {
  isWorkflowActionClickable,
  workflowActionBarLayout,
} from '@features/workflow/ui/workflow-action-bar-layout';
import {
  formatWorkflowStatusLabel,
  workflowStatusBadgeVariant,
} from '@features/workflow/ui/workflow-action-bar-status';
import { WorkflowActionCommand } from '@features/workflow/ui/workflow-action-command';
import { RackBagsModal } from '@features/workflow/ui/rack-bags-modal';

/** Fallback only for gate-override reason length; unrelated to per-action control notes below. */
const DEFAULT_GATE_OVERRIDE_MIN_REASON_LENGTH = 10;

const WF_FIELD_NAMES = {
  controlNotes: 'wf-control-notes',
  overrideReason: 'wf-override-reason',
} as const;

/**
 * Reason/notes visibility and enforcement are policy data (`sys_wf_prof_ver_exec_cf`
 * .requires_reason / .min_reason_length), not a hardcoded action-code list. The
 * field shows whenever `requiresReason` is true; `minReasonLength` of 0 means
 * shown-but-optional, >0 blocks submission below that length.
 */
function actionNeedsControlNotes(action: WorkflowActionDto): boolean {
  return action.requiresReason === true;
}

function actionMinReasonLength(action: WorkflowActionDto): number {
  return action.minReasonLength && action.minReasonLength > 0 ? action.minReasonLength : 0;
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
  /** Optional title override for the action-list layout (e.g. hold/resume/stop). */
  title?: string;
  /** Action codes already represented by a stage-specific completion surface. */
  hiddenActionCodes?: readonly string[];
  /**
   * Stage-owned commands rendered beside configured workflow actions while
   * retaining their own service/API boundary.
   */
  supplementalActions?: ReactNode;
}

function gateDecisionsFor(action: WorkflowActionDto): WorkflowGateDecisionDto[] {
  return action.gateDecisions ?? [];
}

function overrideMinReasonLength(decisions: WorkflowGateDecisionDto[]): number {
  return Math.max(
    DEFAULT_GATE_OVERRIDE_MIN_REASON_LENGTH,
    ...decisions
      .filter((decision) => decision.result === 'OVERRIDABLE')
      .map((decision) => decision.overrideMinReasonLength ?? DEFAULT_GATE_OVERRIDE_MIN_REASON_LENGTH),
  );
}

/**
 * Floor action CTA bar driven by listAvailableActions / executeAction.
 * One visible action uses the next-step command; two or more use the action list.
 * When rack_required blocks an action, opens the shared RackBagsModal to
 * collect rack/locker/bag/hanging fields, then retries the action with the
 * saved rack merged into its execute input.
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
  const [controlNotes, setControlNotes] = useState('');
  const [controlNotesError, setControlNotesError] = useState<string | null>(null);
  const [pendingStopAction, setPendingStopAction] = useState<WorkflowActionDto | null>(null);
  const [pendingGateAction, setPendingGateAction] = useState<WorkflowActionDto | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideReasonError, setOverrideReasonError] = useState<string | null>(null);
  const [rackBagsOpen, setRackBagsOpen] = useState(false);
  const [pendingRackAction, setPendingRackAction] = useState<WorkflowActionDto | null>(null);
  const didRedirectRef = useRef(false);
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
  const controlNotesAction = visible.find((a) => actionNeedsControlNotes(a));
  const needsControlNotes = controlNotesAction != null;
  const controlNotesMin = controlNotesAction ? actionMinReasonLength(controlNotesAction) : 0;
  const controlNotesIsMandatory = controlNotesMin > 0;

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
        <CmxCard className={className} role="region" aria-label={t('actionBarLabel')}>
          <div className="space-y-3 p-4 md:p-5">
            <CmxSkeleton className="h-4 w-28" />
            <CmxSkeleton className="h-12 w-full" />
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          </div>
        </CmxCard>
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

  const statusLabel = formatWorkflowStatusLabel(
    currentStatus,
    (key) => t.has(key),
    (key) => t(key as never),
  );

  if (emptyMode === 'empty') {
    return (
      <>
        <CmxEmptyState
          title={t('emptyScreenTitle')}
          description={
            statusLabel
              ? t('emptyScreenBodyWithStatus', { status: statusLabel })
              : t('emptyScreenBody')
          }
        />
        {children}
      </>
    );
  }

  const notesTrimmed = controlNotes.trim();
  const layout = workflowActionBarLayout(visible);
  const heading = layout.mode === 'action-list' ? (title ?? t('actionBarTitle')) : t('nextStepTitle');
  const primaryClickable = layout.primary ? isWorkflowActionClickable(layout.primary) : false;
  const primaryStatusLabel = layout.primary
    ? formatWorkflowStatusLabel(
        layout.primary.toStatus,
        (key) => t.has(key),
        (key) => t(key as never),
      )
    : null;

  const intent = (() => {
    if (layout.mode === 'action-list') return t('actionListIntent');
    if (!layout.primary) return null;
    if (!primaryClickable) return t('nextStepIntentBlocked');
    if (primaryStatusLabel) return t('nextStepIntent', { status: primaryStatusLabel });
    return t('nextStepIntentNoDest');
  })();

  const executeWorkflowAction = async (
    action: WorkflowActionDto,
    submittedGateDecisions?: ReturnType<typeof toSubmittedGateDecisions>,
    extraInput?: Record<string, unknown>,
  ) => {
    const input: Record<string, unknown> = { ...extraInput };
    if (actionNeedsControlNotes(action)) {
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

  const actionLabel = (action: WorkflowActionDto) =>
    locale.startsWith('ar') && action.label2 ? action.label2 : action.label;

  const actionBlockedReasons = (action: WorkflowActionDto) =>
    action.blockedReasons
      .map((reason) => (locale.startsWith('ar') && reason.message2 ? reason.message2 : reason.message))
      .filter((message) => message.trim().length > 0);

  const actionBlockedHint = (action: WorkflowActionDto) =>
    actionBlockedReasons(action).join(' · ') || null;

  const actionGateHint = (action: WorkflowActionDto) => {
    const decisions = gateDecisionsFor(action);
    if (decisions.length === 0) return null;
    return decisions.some((decision) => decision.result === 'OVERRIDABLE')
      ? t('gateOverrideHint')
      : t('gateWarningHint');
  };

  const actionDestinationLabel = (action: WorkflowActionDto, usualPath: boolean) => {
    const toLabel = formatWorkflowStatusLabel(
      action.toStatus,
      (key) => t.has(key),
      (key) => t(key as never),
    );
    if (usualPath && toLabel) return t('usualNextStepMovesTo', { status: toLabel });
    if (usualPath) return t('usualNextStep');
    if (toLabel) return t('movesToStatus', { status: toLabel });
    return null;
  };

  const pressWorkflowAction = async (action: WorkflowActionDto) => {
    if (isOnlyRackBlocked(action)) {
      setPendingRackAction(action);
      setRackBagsOpen(true);
      return;
    }
    const actionMin = actionMinReasonLength(action);
    if (actionNeedsControlNotes(action) && actionMin > 0 && notesTrimmed.length < actionMin) {
      failField(
        WF_FIELD_NAMES.controlNotes,
        t('controlNotesRequired', { min: actionMin }),
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
  };

  const renderActionCommand = (action: WorkflowActionDto, isPrimary: boolean) => {
    const canClick = isWorkflowActionClickable(action);
    const blockedHint = actionBlockedHint(action);
    const showBlockedOnControl = !isPrimary || canClick;
    return (
      <WorkflowActionCommand
        key={`${action.actionCode}:${action.toStatus ?? ''}`}
        label={actionLabel(action)}
        destinationLabel={actionDestinationLabel(action, isPrimary && layout.mode === 'action-list')}
        hint={canClick ? actionGateHint(action) : null}
        blockedHint={showBlockedOnControl && !canClick ? blockedHint : null}
        canClick={canClick}
        loading={loading}
        isPrimary={isPrimary}
        isStop={action.actionCode === WORKFLOW_ACTIONS.STOP_ORDER_WORK}
        onClick={() => {
          void pressWorkflowAction(action);
        }}
      />
    );
  };

  const pendingGateDecisions = pendingGateAction ? gateDecisionsFor(pendingGateAction) : [];
  const pendingNeedsOverride = pendingGateDecisions.some((decision) => decision.result === 'OVERRIDABLE');
  const pendingNeedsWarning = pendingGateDecisions.some((decision) => decision.result === 'WARNING');
  const pendingOverrideMin = overrideMinReasonLength(pendingGateDecisions);
  const pendingOverridePermission = pendingGateDecisions.find(
    (decision) => decision.result === 'OVERRIDABLE' && decision.overridePermissionCode,
  )?.overridePermissionCode;
  const primaryBlockedItems =
    layout.primary && !primaryClickable ? actionBlockedReasons(layout.primary) : [];

  return (
    <>
      <CmxCard className={className} role="region" aria-label={t('actionBarLabel')}>
        <div className="flex items-start justify-between gap-3 p-4 pb-3 md:p-5 md:pb-3">
          <div className="min-w-0 space-y-1">
            <CmxCardTitle>{heading}</CmxCardTitle>
            {intent ? (
              <p className="text-sm leading-5 text-muted-foreground">{intent}</p>
            ) : null}
          </div>
          {statusLabel ? (
            <CmxStatusBadge
              label={statusLabel}
              variant={workflowStatusBadgeVariant(currentStatus)}
              size="sm"
            />
          ) : null}
        </div>

        <div className="space-y-3 px-4 pb-4 md:px-5 md:pb-5">
          {needsControlNotes ? (
            <CmxFieldShell
              id={`wf-control-notes-${orderId}`}
              name={WF_FIELD_NAMES.controlNotes}
              label={t('controlNotesLabel')}
              hint={
                controlNotesIsMandatory
                  ? t('controlNotesHelp', { min: controlNotesMin })
                  : t('controlNotesHelpOptional')
              }
              error={controlNotesError}
              required={controlNotesIsMandatory}
            >
              <CmxInput
                ref={controlNotesInputRef}
                id={`wf-control-notes-${orderId}`}
                value={controlNotes}
                onChange={(e) => {
                  setControlNotes(e.target.value);
                  setControlNotesError(null);
                }}
                placeholder={
                  controlNotesIsMandatory
                    ? t('controlNotesPlaceholder')
                    : t('controlNotesPlaceholderOptional')
                }
                autoComplete="off"
                aria-invalid={Boolean(controlNotesError)}
                aria-describedby={
                  controlNotesError ? `wf-control-notes-err-${orderId}` : undefined
                }
              />
            </CmxFieldShell>
          ) : null}

          {primaryBlockedItems.length > 0 ? (
            <CmxSummaryMessage type="warning" title={t('blockedTitle')} items={primaryBlockedItems} />
          ) : null}

          {layout.primary ? renderActionCommand(layout.primary, true) : null}
          {layout.rest.length > 0 ? (
            <div className="space-y-2">
              {layout.rest.map((action) => renderActionCommand(action, false))}
            </div>
          ) : null}

          {hasSupplementalActions ? (
            <div className="border-t border-border pt-3">{supplementalActions}</div>
          ) : null}
        </div>
      </CmxCard>
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
      <RackBagsModal
        open={rackBagsOpen}
        onOpenChange={(next) => {
          setRackBagsOpen(next);
          if (!next) setPendingRackAction(null);
        }}
        orderId={orderId}
        onSaved={(saved) => {
          const action = pendingRackAction;
          setRackBagsOpen(false);
          setPendingRackAction(null);
          if (action) {
            void executeWorkflowAction(action, undefined, { rackLocation: saved.rackLocation });
          }
        }}
      />
      {children}
    </>
  );
}
