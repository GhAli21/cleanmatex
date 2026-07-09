'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  ChevronRight,
  CreditCard,
  LockKeyhole,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  WalletCards,
  X,
} from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxTextarea } from '@ui/primitives/cmx-textarea';
import { Badge } from '@ui/primitives/badge';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxStatusBadge } from '@ui/feedback';
import { cmxMessage } from '@ui/feedback';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { cn } from '@/lib/utils';
import { getCSRFHeader, useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import {
  fetchMyActivePosSession,
  fetchPosSessionSummary,
  posSessionActiveQueryKey,
  PosSessionApiError,
  postPosSessionLifecycleAction,
  type PosSessionLifecycleEndpoint,
} from '@features/pos-sessions/api/pos-session-api';
import { PosSessionDrawerCloseSummary } from '@features/pos-sessions/ui/pos-session-drawer-close-summary';
import { PosSessionDrawerLinker } from '@features/pos-sessions/ui/pos-session-drawer-linker';
import type {
  GetMyActivePosSessionResult,
  PosSessionSummary,
  PosSessionWithContext,
} from '@/lib/types/pos-session';

type SessionAction = 'close' | 'force-close';

interface ActionDialogState {
  action: SessionAction | null;
  reason: string;
}

interface PosSessionHubProps {
  branchId: string | null;
}

/**
 * Compact order-entry Session Hub for POS operational context.
 *
 * The Hub keeps healthy POS state out of a wide banner while preserving fast
 * access to session lineage, drawer context, and safe lifecycle actions.
 */
export function PosSessionHub({ branchId }: PosSessionHubProps) {
  const t = useTranslations('posSessions');
  const queryClient = useQueryClient();
  const { token: csrfToken } = useCSRFToken();
  const canOpen = useHasPermissionCode('pos_session:open');
  const canPauseResume = useHasPermissionCode('pos_session:pause_resume');
  const canClose = useHasPermissionCode('pos_session:close');
  const canForceClose = useHasPermissionCode('pos_session:force_close');
  const canViewCashDrawer = useHasPermissionCode('cash_drawer:view');
  const canOpenCashDrawer = useHasPermissionCode('cash_drawer:open_session');
  const canCloseCashDrawer = useHasPermissionCode('cash_drawer:close_session');

  const [hubOpen, setHubOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<ActionDialogState>({ action: null, reason: '' });
  const [drawerDialogOpen, setDrawerDialogOpen] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [drawerNotes, setDrawerNotes] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const activeQuery = useQuery({
    queryKey: posSessionActiveQueryKey(branchId, true),
    enabled: !!branchId,
    queryFn: () => fetchMyActivePosSession({ branchId, includeContext: true }),
    staleTime: 30_000,
  });

  const activeSession = getActiveSession(activeQuery.data);
  const activeSessionContext = activeSession as PosSessionWithContext | null;
  const summaryQuery = useQuery({
    queryKey: ['pos-sessions', 'summary', activeSession?.id ?? 'none', 'hub'],
    enabled: hubOpen && !!activeSession?.id,
    queryFn: () => fetchPosSessionSummary(activeSession!.id),
  });

  const refreshHub = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: posSessionActiveQueryKey(branchId, true) }),
      queryClient.invalidateQueries({ queryKey: ['pos-sessions', 'my-active'] }),
      queryClient.invalidateQueries({ queryKey: ['pos-sessions', 'summary'] }),
    ]);
  };

  const runLifecycleAction = async (
    endpoint: PosSessionLifecycleEndpoint,
    body: Record<string, unknown>,
    successMessage: string
  ): Promise<'ok' | 'drawer-open' | 'error'> => {
    setBusyAction(endpoint);
    try {
      await postPosSessionLifecycleAction(endpoint, {
        csrfToken,
        body,
        sourceChannel: 'new_order_session_hub',
      });
      cmxMessage.success(successMessage);
      await refreshHub();
      return 'ok';
    } catch (error) {
      if (error instanceof PosSessionApiError && error.errorCode === 'POS_SESSION_DRAWER_STILL_OPEN') {
        if (!canCloseCashDrawer) {
          cmxMessage.error(t('messages.drawerClosePermissionRequired'));
          return 'error';
        }
        setDrawerDialogOpen(true);
        cmxMessage.info(t('messages.drawerStillOpen'));
        return 'drawer-open';
      }
      cmxMessage.error(error instanceof Error ? error.message : t('messages.actionFailed'));
      return 'error';
    } finally {
      setBusyAction(null);
    }
  };

  const submitActionDialog = async () => {
    if (!actionDialog.action) return;
    const endpoint = actionDialog.action === 'force-close' ? 'force-close' : 'close';
    const result = await runLifecycleAction(
      endpoint,
      { reason: actionDialog.reason || undefined },
      endpoint === 'force-close' ? t('messages.forceClosed') : t('messages.closed')
    );
    if (result === 'ok') {
      setActionDialog({ action: null, reason: '' });
    }
  };

  const startPosSession = async () => {
    if (!branchId) {
      cmxMessage.error(t('messages.selectBranch'));
      return;
    }
    await runLifecycleAction('open', { branchId }, t('messages.opened'));
  };

  const closeDrawerThenSession = async () => {
    if (!activeSession?.cash_drawer_id || !activeSession.cash_drawer_session_id || !actionDialog.action) {
      cmxMessage.error(t('messages.actionFailed'));
      return;
    }
    if (!canCloseCashDrawer) {
      cmxMessage.error(t('messages.drawerClosePermissionRequired'));
      return;
    }
    const numericCount = Number(countedCash);
    if (!Number.isFinite(numericCount) || numericCount < 0) {
      cmxMessage.error(t('messages.countedCashRequired'));
      return;
    }

    setBusyAction('drawer-close');
    try {
      const response = await fetch(`/api/v1/cash-drawers/${activeSession.cash_drawer_id}/close-session`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getCSRFHeader(csrfToken),
        },
        body: JSON.stringify({
          sessionId: activeSession.cash_drawer_session_id,
          physicalCount: numericCount,
          notes: drawerNotes || undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || t('messages.actionFailed'));
      }
      cmxMessage.success(t('messages.drawerClosed'));
      setDrawerDialogOpen(false);
      setCountedCash('');
      setDrawerNotes('');
      await submitActionDialog();
    } catch (error) {
      cmxMessage.error(error instanceof Error ? error.message : t('messages.actionFailed'));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <>
      <CmxButton
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          'max-w-full gap-2 rounded-full border-2 bg-white px-3 shadow-sm',
          triggerToneClass(activeQuery.data, activeQuery.isError)
        )}
        onClick={() => setHubOpen(true)}
        aria-label={t('hub.openAria')}
      >
        <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate font-semibold">{t('hub.title')}</span>
        <HubTriggerStatus queryData={activeQuery.data} isLoading={activeQuery.isLoading} isError={activeQuery.isError} />
        <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden />
      </CmxButton>

      <CmxDialog open={hubOpen} onOpenChange={setHubOpen}>
        <CmxDialogContent
          bodyPadding="none"
          className="!fixed inset-x-0 bottom-0 top-20 z-[70] ms-0 flex h-auto w-full !max-h-[calc(100dvh-5rem)] flex-col !overflow-hidden rounded-none rounded-t-2xl sm:inset-x-auto sm:end-0 sm:max-w-[32rem] sm:rounded-s-2xl sm:rounded-t-none"
        >
          <CmxDialogHeader className="shrink-0 pe-14">
            <div className="flex items-start justify-between gap-3">
              <CmxDialogTitle className="flex flex-wrap items-center gap-2">
                <CreditCard className="h-5 w-5" aria-hidden />
                {t('hub.title')}
                <HubPanelStatus queryData={activeQuery.data} isLoading={activeQuery.isLoading} isError={activeQuery.isError} />
              </CmxDialogTitle>
              <CmxButton
                type="button"
                variant="ghost"
                size="sm"
                className="-mt-1 shrink-0 rounded-full px-2"
                onClick={() => setHubOpen(false)}
                aria-label={t('hub.closePanel')}
              >
                <X className="h-4 w-4" aria-hidden />
              </CmxButton>
            </div>
            <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('hub.description')}
            </p>
          </CmxDialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <HubBody
              queryData={activeQuery.data}
              isLoading={activeQuery.isLoading}
              isError={activeQuery.isError}
              canViewCashDrawer={canViewCashDrawer}
              canOpenCashDrawer={canOpenCashDrawer}
              canOpenPosSession={canOpen}
              summary={summaryQuery.data}
              summaryLoading={summaryQuery.isLoading}
              summaryError={summaryQuery.isError}
              onRetry={refreshHub}
              onStartPosSession={startPosSession}
              onDrawerLinked={refreshHub}
            />
          </div>

          <CmxDialogFooter className="shrink-0 flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <CmxButton variant="outline" size="sm" loading={activeQuery.isFetching} onClick={refreshHub}>
                <RefreshCw className="me-2 h-4 w-4" aria-hidden />
                {t('refresh')}
              </CmxButton>
              <CmxButton variant="ghost" size="sm" onClick={() => setHubOpen(false)}>
                {t('hub.closePanel')}
              </CmxButton>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {activeSession?.status === POS_SESSION_STATUS.OPEN && canPauseResume ? (
                <CmxButton
                  variant="secondary"
                  size="sm"
                  loading={busyAction === 'pause'}
                  onClick={() => runLifecycleAction('pause', {}, t('messages.paused'))}
                >
                  <Pause className="me-2 h-4 w-4" aria-hidden />
                  {t('pause')}
                </CmxButton>
              ) : null}
              {activeSession?.status === POS_SESSION_STATUS.PAUSED && canPauseResume ? (
                <CmxButton
                  variant="secondary"
                  size="sm"
                  loading={busyAction === 'resume'}
                  onClick={() => runLifecycleAction('resume', {}, t('messages.resumed'))}
                >
                  <Play className="me-2 h-4 w-4" aria-hidden />
                  {t('resume')}
                </CmxButton>
              ) : null}
              {activeSession && canClose ? (
                <CmxButton
                  variant="outline"
                  size="sm"
                  onClick={() => setActionDialog({ action: 'close', reason: '' })}
                >
                  {t('close')}
                </CmxButton>
              ) : null}
              {activeSession && canForceClose ? (
                <CmxButton
                  variant="destructive"
                  size="sm"
                  onClick={() => setActionDialog({ action: 'force-close', reason: '' })}
                >
                  {t('forceClose')}
                </CmxButton>
              ) : null}
              <CmxButton asChild variant="outline" size="sm">
                <Link href="/dashboard/internal_fin/pos-sessions">{t('banner.manage')}</Link>
              </CmxButton>
            </div>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={actionDialog.action !== null} onOpenChange={(open) => !open && setActionDialog({ action: null, reason: '' })}>
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{actionDialog.action === 'force-close' ? t('forceClose') : t('close')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            {actionDialog.action === 'force-close' ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <ShieldAlert className="me-2 inline h-4 w-4" aria-hidden />
                {t('hub.forceCloseWarning')}
              </div>
            ) : null}
            <CmxTextarea
              value={actionDialog.reason}
              placeholder={t('reason')}
              onChange={(event) => setActionDialog((current) => ({ ...current, reason: event.target.value }))}
            />
          </div>
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setActionDialog({ action: null, reason: '' })}>
              {t('cancel')}
            </CmxButton>
            <CmxButton
              variant={actionDialog.action === 'force-close' ? 'destructive' : 'primary'}
              disabled={actionDialog.action === 'force-close' && actionDialog.reason.trim().length === 0}
              loading={busyAction === actionDialog.action}
              onClick={submitActionDialog}
            >
              {actionDialog.action === 'force-close' ? t('forceClose') : t('close')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={drawerDialogOpen} onOpenChange={setDrawerDialogOpen}>
        <CmxDialogContent className="max-w-2xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('drawerCloseStep')}</CmxDialogTitle>
          </CmxDialogHeader>
          <PosSessionDrawerCloseSummary
            open={drawerDialogOpen}
            drawerId={activeSession?.cash_drawer_id}
            drawerName={activeSessionContext?.cash_drawer_name}
            drawerSessionId={activeSession?.cash_drawer_session_id}
            drawerSessionNo={activeSessionContext?.cash_drawer_session_no}
            drawerStatus={activeSessionContext?.cash_drawer_session_status}
            canViewCashDrawer={canViewCashDrawer}
            countedCash={countedCash}
            notes={drawerNotes}
            onCountedCashChange={setCountedCash}
            onNotesChange={setDrawerNotes}
          />
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setDrawerDialogOpen(false)}>
              {t('cancel')}
            </CmxButton>
            <CmxButton disabled={!canCloseCashDrawer} loading={busyAction === 'drawer-close'} onClick={closeDrawerThenSession}>
              {t('drawerCloseStep')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </>
  );
}

function HubBody({
  queryData,
  isLoading,
  isError,
  canViewCashDrawer,
  canOpenCashDrawer,
  canOpenPosSession,
  summary,
  summaryLoading,
  summaryError,
  onRetry,
  onStartPosSession,
  onDrawerLinked,
}: {
  queryData?: GetMyActivePosSessionResult;
  isLoading: boolean;
  isError: boolean;
  canViewCashDrawer: boolean;
  canOpenCashDrawer: boolean;
  canOpenPosSession: boolean;
  summary?: PosSessionSummary;
  summaryLoading: boolean;
  summaryError: boolean;
  onRetry: () => void;
  onStartPosSession: () => void;
  onDrawerLinked: () => Promise<void> | void;
}) {
  const t = useTranslations('posSessions');

  if (isLoading) {
    return <PanelMessage icon={<CreditCard className="h-5 w-5" aria-hidden />} title={t('banner.loading')} />;
  }

  if (isError) {
    return (
      <PanelMessage
        icon={<AlertCircle className="h-5 w-5" aria-hidden />}
        title={t('messages.loadFailed')}
        actionLabel={t('refresh')}
        onAction={onRetry}
      />
    );
  }

  if (queryData?.type === 'BRANCH_CONFLICT') {
    const session = queryData.activeSession as PosSessionWithContext;
    return (
      <div className="space-y-4">
        <NoticeCard tone="danger" title={t('hub.branchConflictTitle')} description={t('banner.branchConflict')} />
        <InfoGrid>
          <InfoTile label={t('hub.requestedBranch')} value={queryData.requestedBranchId} />
          <InfoTile label={t('hub.activeBranch')} value={displayBranch(session)} />
          <InfoTile label={t('sessionNo')} value={session.session_no} />
          <InfoTile label={t('status')} value={session.status} />
        </InfoGrid>
      </div>
    );
  }

  if (!queryData || queryData.type === 'NONE') {
    return (
      <PanelMessage
        icon={<CreditCard className="h-5 w-5" aria-hidden />}
        title={t('noActiveTitle')}
        description={t('banner.none')}
        actionLabel={canOpenPosSession ? t('hub.startPosSession') : undefined}
        onAction={canOpenPosSession ? onStartPosSession : undefined}
      />
    );
  }

  const session = queryData.session as PosSessionWithContext;
  return (
    <div className="space-y-4">
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" aria-hidden />
            {t('hub.posSession')}
          </CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CmxStatusBadge label={session.status} variant={statusVariant(session.status)} size="sm" />
            <Badge variant="outline">{session.session_no}</Badge>
          </div>
          <InfoGrid>
            <InfoTile label={t('branch')} value={displayBranch(session)} />
            <InfoTile label={t('businessDate')} value={session.business_date} />
            <InfoTile label={t('hub.timezone')} value={session.business_timezone} />
            <InfoTile label={t('openedAt')} value={formatDateTime(session.opened_at)} />
            <InfoTile label={t('terminal')} value={displayTerminal(session, t('none'))} />
          </InfoGrid>
        </CmxCardContent>
      </CmxCard>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle className="flex items-center gap-2 text-base">
            <WalletCards className="h-4 w-4" aria-hidden />
            {t('cashDrawer')}
          </CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          {canViewCashDrawer ? (
            session.cash_drawer_session_id ? (
              <InfoGrid>
                <InfoTile label={t('cashDrawer')} value={session.cash_drawer_name ?? t('hub.drawerNotLinked')} />
                <InfoTile label={t('drawerSession')} value={session.cash_drawer_session_no ?? session.cash_drawer_session_id ?? t('none')} />
                <InfoTile label={t('status')} value={session.cash_drawer_session_status ?? t('none')} />
              </InfoGrid>
            ) : session.status === POS_SESSION_STATUS.OPEN ? (
              <PosSessionDrawerLinker
                branchId={session.branch_id}
                posSessionId={session.id}
                canViewCashDrawer={canViewCashDrawer}
                canOpenCashDrawer={canOpenCashDrawer}
                onLinked={onDrawerLinked}
              />
            ) : (
              <DrawerSetupPausedNotice />
            )
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{t('hub.drawerRestricted')}</span>
            </div>
          )}
        </CmxCardContent>
      </CmxCard>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle className="text-base">{t('hub.financeSummary')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          {summaryLoading ? (
            <div className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('hub.summaryLoading')}</div>
          ) : summaryError ? (
            <div className="text-sm text-red-700">{t('hub.summaryError')}</div>
          ) : summary ? (
            <InfoGrid>
              <InfoTile label={t('summary.payments')} value={formatMoney(summary.payments.total.amount, summary.payments.total.currencyCode)} />
              <InfoTile label={t('summary.refunds')} value={formatMoney(summary.refunds.total.amount, summary.refunds.total.currencyCode)} />
              <InfoTile label={t('summary.voucherLines')} value={formatMoney(summary.voucherLines.total.amount, summary.voucherLines.total.currencyCode)} />
            </InfoGrid>
          ) : (
            <div className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('hub.openToLoadSummary')}</div>
          )}
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}

function DrawerSetupPausedNotice() {
  const t = useTranslations('posSessions');
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      {t('hub.resumeBeforeDrawerLink')}
    </div>
  );
}

function HubTriggerStatus({
  queryData,
  isLoading,
  isError,
}: {
  queryData?: GetMyActivePosSessionResult;
  isLoading: boolean;
  isError: boolean;
}) {
  const t = useTranslations('posSessions');
  if (isLoading) return <Badge variant="info">{t('hub.checking')}</Badge>;
  if (isError) return <Badge variant="destructive">{t('hub.error')}</Badge>;
  if (queryData?.type === 'BRANCH_CONFLICT') return <Badge variant="destructive">{t('hub.branchConflictBadge')}</Badge>;
  if (queryData?.type === 'ACTIVE') {
    const tone = queryData.session.status === POS_SESSION_STATUS.PAUSED ? 'warning' : 'success';
    return <Badge variant={tone}>{queryData.session.status}</Badge>;
  }
  return <Badge variant="info">{t('hub.autoOpen')}</Badge>;
}

function HubPanelStatus({
  queryData,
  isLoading,
  isError,
}: {
  queryData?: GetMyActivePosSessionResult;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading || isError || !queryData || queryData.type !== 'ACTIVE') {
    return <HubTriggerStatus queryData={queryData} isLoading={isLoading} isError={isError} />;
  }
  return <CmxStatusBadge label={queryData.session.status} variant={statusVariant(queryData.session.status)} size="sm" />;
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,248_250_252))] p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{value}</div>
    </div>
  );
}

function NoticeCard({ tone, title, description }: { tone: 'danger'; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-950">
      <div className="flex items-center gap-2 font-semibold">
        <AlertCircle className="h-4 w-4" aria-hidden />
        {title}
      </div>
      <p className="mt-2 text-sm">{description}</p>
    </div>
  );
}

function PanelMessage({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <div className="rounded-full bg-white p-3 text-slate-600 shadow-sm">{icon}</div>
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <CmxButton variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </CmxButton>
      ) : null}
    </div>
  );
}

function getActiveSession(result?: GetMyActivePosSessionResult) {
  if (result?.type === 'ACTIVE') return result.session;
  return null;
}

function triggerToneClass(result?: GetMyActivePosSessionResult, isError?: boolean): string {
  if (isError || result?.type === 'BRANCH_CONFLICT') return 'border-red-200 text-red-900';
  if (result?.type === 'ACTIVE' && result.session.status === POS_SESSION_STATUS.PAUSED) {
    return 'border-amber-200 text-amber-900';
  }
  if (result?.type === 'ACTIVE') return 'border-emerald-200 text-emerald-900';
  return 'border-sky-200 text-sky-900';
}

function statusVariant(status: string): 'success' | 'warning' | 'error' | 'outline' {
  if (status === POS_SESSION_STATUS.OPEN) return 'success';
  if (status === POS_SESSION_STATUS.PAUSED) return 'warning';
  if (status === POS_SESSION_STATUS.FORCE_CLOSED) return 'error';
  return 'outline';
}

function displayBranch(session: PosSessionWithContext): string {
  return session.branch_name ?? session.branch_name2 ?? session.branch_id;
}

function displayTerminal(session: PosSessionWithContext, emptyLabel: string): string {
  if (session.terminal_name && session.terminal_code) return `${session.terminal_name} (${session.terminal_code})`;
  return session.terminal_name ?? session.terminal_code ?? session.terminal_id ?? emptyLabel;
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatMoney(amount: number, currencyCode: string | null): string {
  return `${amount.toFixed(3)} ${currencyCode ?? ''}`.trim();
}
