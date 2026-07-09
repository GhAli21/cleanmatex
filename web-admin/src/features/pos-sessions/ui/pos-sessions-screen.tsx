'use client';

import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { CreditCard, RefreshCw, ShieldAlert } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxSelect } from '@ui/primitives';
import { CmxTextarea } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { Badge } from '@ui/primitives/badge';
import { CmxDataTable, type CmxDataTableSimpleColumn } from '@ui/data-display';
import { CmxEmptyState } from '@ui/data-display';
import { CmxStatusBadge } from '@ui/feedback';
import { cmxMessage } from '@ui/feedback';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { getCSRFHeader, useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import {
  fetchMyActivePosSession,
  fetchPosSessionSummary,
  PosSessionApiError,
  postPosSessionLifecycleAction,
} from '@features/pos-sessions/api/pos-session-api';
import { PosSessionDrawerCloseSummary } from '@features/pos-sessions/ui/pos-session-drawer-close-summary';
import type {
  GetMyActivePosSessionResult,
  PosSessionListResult,
  PosSessionListRow,
  PosSessionRow,
  PosSessionWithContext,
} from '@/lib/types/pos-session';

interface BranchOption {
  id: string;
  name?: string | null;
  branch_name?: string | null;
}

type ApiEnvelope<T> = { success?: boolean; data?: T; error?: string; errorCode?: string };

const PAGE_SIZE = 20;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T> | { data?: T };
  if (!response.ok) {
    throw new Error(('error' in payload && payload.error) || `Request failed: ${response.status}`);
  }
  if ('success' in payload && payload.success === false) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload.data as T;
}

function statusVariant(status: string): 'success' | 'warning' | 'error' | 'outline' {
  if (status === POS_SESSION_STATUS.OPEN) return 'success';
  if (status === POS_SESSION_STATUS.PAUSED) return 'warning';
  if (status === POS_SESSION_STATUS.FORCE_CLOSED) return 'error';
  return 'outline';
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

function sessionDisplayBranch(session: PosSessionListRow | PosSessionRow): string {
  const row = session as PosSessionListRow;
  return row.branch_name ?? row.branch_name2 ?? session.branch_id;
}

interface SessionActionDialogState {
  action: 'close' | 'force-close' | null;
  reason: string;
}

export function PosSessionsScreen() {
  const t = useTranslations('posSessions');
  const queryClient = useQueryClient();
  const { token: csrfToken } = useCSRFToken();
  const canViewAll = useHasPermissionCode('pos_session:view_all');
  const canOpen = useHasPermissionCode('pos_session:open');
  const canPauseResume = useHasPermissionCode('pos_session:pause_resume');
  const canClose = useHasPermissionCode('pos_session:close');
  const canForceClose = useHasPermissionCode('pos_session:force_close');
  const canViewCashDrawer = useHasPermissionCode('cash_drawer:view');
  const canCloseCashDrawer = useHasPermissionCode('cash_drawer:close_session');

  const [page, setPage] = useState(1);
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [scope, setScope] = useState<'own' | 'all'>('own');
  const [openBranchId, setOpenBranchId] = useState('');
  const [actionDialog, setActionDialog] = useState<SessionActionDialogState>({ action: null, reason: '' });
  const [drawerDialogOpen, setDrawerDialogOpen] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [drawerNotes, setDrawerNotes] = useState('');
  const [summarySessionId, setSummarySessionId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const branchesQuery = useQuery({
    queryKey: ['pos-sessions', 'branches'],
    queryFn: () => fetchJson<BranchOption[]>('/api/v1/branches'),
  });

  const activeQuery = useQuery({
    queryKey: ['pos-sessions', 'my-active'],
    queryFn: () => fetchMyActivePosSession({ includeContext: true }),
  });

  const sessionsQuery = useQuery({
    queryKey: ['pos-sessions', 'list', page, branchId, status, scope],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        scope,
      });
      if (branchId) params.set('branchId', branchId);
      if (status) params.set('status', status);
      return fetchJson<PosSessionListResult>(`/api/v1/pos-sessions?${params.toString()}`);
    },
  });

  const summaryQuery = useQuery({
    queryKey: ['pos-sessions', 'summary', summarySessionId],
    enabled: !!summarySessionId,
    queryFn: () => fetchPosSessionSummary(summarySessionId!),
  });

  const activeSession =
    activeQuery.data?.type === 'ACTIVE' ? activeQuery.data.session : null;
  const activeSessionContext = activeSession as PosSessionWithContext | null;

  const refreshAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['pos-sessions', 'my-active'] }),
      queryClient.invalidateQueries({ queryKey: ['pos-sessions', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['pos-sessions', 'summary'] }),
    ]);
  }, [queryClient]);

  const runLifecycleAction = useCallback(async (
    endpoint: 'open' | 'pause' | 'resume' | 'close' | 'force-close',
    body: Record<string, unknown>,
    successMessage: string
  ): Promise<'ok' | 'drawer-open' | 'error'> => {
    setBusyAction(endpoint);
    try {
      await postPosSessionLifecycleAction(endpoint, {
        csrfToken,
        body,
        sourceChannel: 'pos_session_workbench',
      });
      cmxMessage.success(successMessage);
      await refreshAll();
      return 'ok';
    } catch (error) {
      if (error instanceof PosSessionApiError && error.errorCode === 'POS_SESSION_DRAWER_STILL_OPEN') {
        setDrawerDialogOpen(true);
        cmxMessage.info(t('messages.drawerStillOpen'));
        return 'drawer-open';
      }
      cmxMessage.error(error instanceof Error ? error.message : t('messages.actionFailed'));
      return 'error';
    } finally {
      setBusyAction(null);
    }
  }, [csrfToken, refreshAll, t]);

  const openSession = useCallback(async () => {
    if (!openBranchId) {
      cmxMessage.error(t('messages.selectBranch'));
      return;
    }
    await runLifecycleAction('open', { branchId: openBranchId }, t('messages.opened'));
  }, [openBranchId, runLifecycleAction, t]);

  const closeDrawerThenSession = useCallback(async () => {
    if (!activeSession?.cash_drawer_id || !activeSession.cash_drawer_session_id) {
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
      const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<unknown>;
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || t('messages.actionFailed'));
      }
      cmxMessage.success(t('messages.drawerClosed'));
      setDrawerDialogOpen(false);
      setCountedCash('');
      setDrawerNotes('');
      await runLifecycleAction(
        actionDialog.action === 'force-close' ? 'force-close' : 'close',
        { reason: actionDialog.reason || undefined },
        actionDialog.action === 'force-close' ? t('messages.forceClosed') : t('messages.closed')
      );
      setActionDialog({ action: null, reason: '' });
    } catch (error) {
      cmxMessage.error(error instanceof Error ? error.message : t('messages.actionFailed'));
    } finally {
      setBusyAction(null);
    }
  }, [activeSession, actionDialog, canCloseCashDrawer, countedCash, csrfToken, drawerNotes, runLifecycleAction, t]);

  const branchOptions = (branchesQuery.data ?? []).map((branch) => ({
    value: branch.id,
    label: branch.name ?? branch.branch_name ?? branch.id,
  }));

  const statusOptions = [
    { value: 'OPEN', label: 'OPEN' },
    { value: 'PAUSED', label: 'PAUSED' },
    { value: 'CLOSED', label: 'CLOSED' },
    { value: 'FORCE_CLOSED', label: 'FORCE_CLOSED' },
  ];

  const columns: CmxDataTableSimpleColumn<PosSessionListRow>[] = [
    {
      key: 'session_no',
      header: t('sessionNo'),
      render: (row) => (
        <div className="space-y-1">
          <div className="font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{row.session_no}</div>
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{row.id.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('status'),
      render: (row) => <CmxStatusBadge label={row.status} variant={statusVariant(row.status)} size="sm" />,
    },
    {
      key: 'branch',
      header: t('branch'),
      render: (row) => sessionDisplayBranch(row),
    },
    {
      key: 'business_date',
      header: t('businessDate'),
      render: (row) => (
        <div>
          <div>{row.business_date}</div>
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{row.business_timezone}</div>
        </div>
      ),
    },
    {
      key: 'opened_at',
      header: t('openedAt'),
      render: (row) => formatDateTime(row.opened_at),
    },
    {
      key: 'closed_at',
      header: t('closedAt'),
      render: (row) => formatDateTime(row.closed_at ?? row.force_closed_at),
    },
    {
      key: 'drawer',
      header: t('cashDrawer'),
      render: (row) => (
        <div className="space-y-1">
          <div>{row.cash_drawer_name ?? t('none')}</div>
          {row.cash_drawer_session_no ? (
            <Badge variant={row.cash_drawer_session_status === 'OPEN' ? 'success' : 'secondary'}>
              {row.cash_drawer_session_no} / {row.cash_drawer_session_status}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      align: 'right',
      render: (row) => (
        <CmxButton size="sm" variant="outline" onClick={() => setSummarySessionId(row.id)}>
          {t('viewSummary')}
        </CmxButton>
      ),
    },
  ];

  const sessions = sessionsQuery.data?.items ?? [];
  const total = sessionsQuery.data?.total ?? 0;
  const activeTitle = activeSession ? activeSession.session_no : t('noActiveTitle');

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('title')}</h1>
          <p className="mt-1 max-w-3xl text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('description')}
          </p>
        </div>
        <CmxButton variant="outline" onClick={refreshAll} disabled={sessionsQuery.isFetching || activeQuery.isFetching}>
          <RefreshCw className="me-2 h-4 w-4" aria-hidden />
          {t('refresh')}
        </CmxButton>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" aria-hidden />
              {t('activeTitle')}
            </CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="space-y-4">
            {activeSession ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <CmxStatusBadge
                    label={activeSession.status}
                    variant={statusVariant(activeSession.status)}
                    size="sm"
                  />
                  <Badge variant="outline">{activeTitle}</Badge>
                  <Badge variant="outline">{activeSession.business_date}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoTile label={t('branch')} value={sessionDisplayBranch(activeSession)} />
                  <InfoTile label={t('openedAt')} value={formatDateTime(activeSession.opened_at)} />
                  <InfoTile label={t('terminal')} value={activeSession.terminal_id ?? t('none')} />
                  <InfoTile label={t('cashDrawer')} value={activeSession.cash_drawer_session_id ?? t('none')} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {canPauseResume && activeSession.status === POS_SESSION_STATUS.OPEN ? (
                    <CmxButton
                      variant="secondary"
                      loading={busyAction === 'pause'}
                      onClick={() => runLifecycleAction('pause', {}, t('messages.paused'))}
                    >
                      {t('pause')}
                    </CmxButton>
                  ) : null}
                  {canPauseResume && activeSession.status === POS_SESSION_STATUS.PAUSED ? (
                    <CmxButton
                      variant="secondary"
                      loading={busyAction === 'resume'}
                      onClick={() => runLifecycleAction('resume', {}, t('messages.resumed'))}
                    >
                      {t('resume')}
                    </CmxButton>
                  ) : null}
                  {canClose ? (
                    <CmxButton
                      variant="outline"
                      onClick={() => setActionDialog({ action: 'close', reason: '' })}
                    >
                      {t('close')}
                    </CmxButton>
                  ) : null}
                  {canForceClose ? (
                    <CmxButton
                      variant="destructive"
                      onClick={() => setActionDialog({ action: 'force-close', reason: '' })}
                    >
                      {t('forceClose')}
                    </CmxButton>
                  ) : null}
                </div>
              </>
            ) : (
              <CmxEmptyState
                icon={<CreditCard className="h-8 w-8" aria-hidden />}
                title={t('noActiveTitle')}
                description={t('noActiveDescription')}
              />
            )}
          </CmxCardContent>
        </CmxCard>

        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('openSession')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="space-y-4">
            <CmxSelect
              label={t('branch')}
              placeholder={t('selectBranch')}
              value={openBranchId}
              options={branchOptions}
              disabled={branchesQuery.isLoading || !canOpen}
              onChange={(event) => setOpenBranchId(event.target.value)}
            />
            <CmxButton
              className="w-full"
              disabled={!canOpen}
              loading={busyAction === 'open'}
              onClick={openSession}
            >
              {t('openSession')}
            </CmxButton>
          </CmxCardContent>
        </CmxCard>
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('historyTitle')}</CmxCardTitle>
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('historyDescription')}</p>
        </CmxCardHeader>
        <CmxCardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <CmxSelect
              label={t('branch')}
              value={branchId}
              placeholder={t('optionalBranch')}
              options={[{ value: '', label: t('optionalBranch') }, ...branchOptions]}
              onChange={(event) => {
                setPage(1);
                setBranchId(event.target.value);
              }}
            />
            <CmxSelect
              label={t('status')}
              value={status}
              placeholder={t('allStatuses')}
              options={[{ value: '', label: t('allStatuses') }, ...statusOptions]}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
            />
            <CmxSelect
              label={t('scope')}
              value={scope}
              options={[
                { value: 'own', label: t('ownSessions') },
                { value: 'all', label: t('allSessions'), disabled: !canViewAll },
              ]}
              onChange={(event) => {
                setPage(1);
                setScope(event.target.value === 'all' ? 'all' : 'own');
              }}
            />
          </div>
          <CmxDataTable
            columns={columns}
            data={sessions}
            loading={sessionsQuery.isLoading}
            currentPage={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            emptyStateTitle={t('historyTitle')}
            emptyStateDescription={t('noActiveDescription')}
            paginationFooter="auto"
          />
        </CmxCardContent>
      </CmxCard>

      <CmxDialog open={actionDialog.action !== null} onOpenChange={(open) => !open && setActionDialog({ action: null, reason: '' })}>
        <CmxDialogContent>
          <CmxDialogHeader>
            <CmxDialogTitle>
              {actionDialog.action === 'force-close' ? t('forceClose') : t('close')}
            </CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            {actionDialog.action === 'force-close' ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <ShieldAlert className="me-2 inline h-4 w-4" aria-hidden />
                {t('forceClose')}
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
              onClick={() => {
                const endpoint = actionDialog.action === 'force-close' ? 'force-close' : 'close';
                runLifecycleAction(
                  endpoint,
                  { reason: actionDialog.reason || undefined },
                  endpoint === 'force-close' ? t('messages.forceClosed') : t('messages.closed')
                ).then((result) => {
                  if (result === 'ok') {
                    setActionDialog({ action: null, reason: '' });
                  }
                });
              }}
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

      <CmxDialog open={!!summarySessionId} onOpenChange={(open) => !open && setSummarySessionId(null)}>
        <CmxDialogContent className="max-w-3xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('viewSummary')}</CmxDialogTitle>
          </CmxDialogHeader>
          {summaryQuery.isLoading ? (
            <div className="py-8 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('banner.loading')}</div>
          ) : summaryQuery.data ? (
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryTile title={t('summary.payments')} total={summaryQuery.data.payments.total} rowsLabel={t('summary.rows')} />
              <SummaryTile title={t('summary.refunds')} total={summaryQuery.data.refunds.total} rowsLabel={t('summary.rows')} />
              <SummaryTile title={t('summary.voucherLines')} total={summaryQuery.data.voucherLines.total} rowsLabel={t('summary.rows')} />
            </div>
          ) : (
            <div className="py-8 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('messages.loadFailed')}
            </div>
          )}
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setSummarySessionId(null)}>
              {t('cancel')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,248_250_252))] p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{value}</div>
    </div>
  );
}

function SummaryTile({
  title,
  total,
  rowsLabel,
}: {
  title: string;
  total: { amount: number; currencyCode: string | null; count: number };
  rowsLabel: string;
}) {
  return (
    <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
      <div className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{title}</div>
      <div className="mt-2 text-2xl font-bold">{formatMoney(total.amount, total.currencyCode)}</div>
      <div className="mt-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{total.count} {rowsLabel}</div>
    </div>
  );
}
