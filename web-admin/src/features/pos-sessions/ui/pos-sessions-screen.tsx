'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Check, Copy, CreditCard, RefreshCw, ShieldAlert } from 'lucide-react';
import { CmxButton, CmxInput } from '@ui/primitives';
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
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
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
  PosSessionEventListResult,
  PosSessionEventListRow,
  PosSessionRow,
  PosSessionWithContext,
} from '@/lib/types/pos-session';

interface BranchOption {
  id: string;
  name?: string | null;
  branch_name?: string | null;
}

type ApiEnvelope<T> = { success?: boolean; data?: T; error?: string; errorCode?: string };

// Limits the wide operational grid to a scan-friendly page while the server remains authoritative for paging.
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

function sessionDisplayBranch(session: PosSessionListRow | PosSessionRow): string {
  const row = session as PosSessionListRow;
  return row.branch_name ?? row.branch_name2 ?? session.branch_id;
}

interface SessionActionDialogState {
  action: 'close' | 'force-close' | null;
  reason: string;
}

/**
 * Operates the authenticated user's POS session and exposes authorized session history.
 *
 * The API derives tenant and own/all visibility server-side; this screen only sends
 * user-selected, bounded filters and lifecycle intent.
 */
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
  const [sessionNo, setSessionNo] = useState('');
  const [operatorQuery, setOperatorQuery] = useState('');
  const [terminalQuery, setTerminalQuery] = useState('');
  const [cashDrawerQuery, setCashDrawerQuery] = useState('');
  const [businessDateFrom, setBusinessDateFrom] = useState('');
  const [businessDateTo, setBusinessDateTo] = useState('');
  const [openedAtFrom, setOpenedAtFrom] = useState('');
  const [openedAtTo, setOpenedAtTo] = useState('');
  const [openBranchId, setOpenBranchId] = useState('');
  const [actionDialog, setActionDialog] = useState<SessionActionDialogState>({ action: null, reason: '' });
  const [drawerDialogOpen, setDrawerDialogOpen] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [drawerNotes, setDrawerNotes] = useState('');
  const [summarySessionId, setSummarySessionId] = useState<string | null>(null);
  const [eventsSession, setEventsSession] = useState<PosSessionListRow | null>(null);
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
    queryKey: ['pos-sessions', 'list', page, branchId, status, scope, sessionNo, operatorQuery, terminalQuery, cashDrawerQuery, businessDateFrom, businessDateTo, openedAtFrom, openedAtTo],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        scope,
      });
      if (branchId) params.set('branchId', branchId);
      if (status) params.set('status', status);
      if (sessionNo.trim()) params.set('sessionNo', sessionNo.trim());
      if (operatorQuery.trim()) params.set('operatorQuery', operatorQuery.trim());
      if (terminalQuery.trim()) params.set('terminalQuery', terminalQuery.trim());
      if (cashDrawerQuery.trim()) params.set('cashDrawerQuery', cashDrawerQuery.trim());
      if (businessDateFrom) params.set('businessDateFrom', businessDateFrom);
      if (businessDateTo) params.set('businessDateTo', businessDateTo);
      if (openedAtFrom) params.set('openedAtFrom', openedAtFrom);
      if (openedAtTo) params.set('openedAtTo', openedAtTo);
      return fetchJson<PosSessionListResult>(`/api/v1/pos-sessions?${params.toString()}`);
    },
  });

  const summaryQuery = useQuery({
    queryKey: ['pos-sessions', 'summary', summarySessionId],
    // Prevent query before a session is selected — avoids an invalid detail request.
    enabled: !!summarySessionId,
    queryFn: () => fetchPosSessionSummary(summarySessionId!),
  });

  const eventsQuery = useQuery({
    queryKey: ['pos-sessions', 'events', eventsSession?.id],
    // Prevent query before a session is selected — avoids an invalid audit request.
    enabled: !!eventsSession,
    queryFn: () => fetchJson<PosSessionEventListResult>(`/api/v1/pos-sessions/${eventsSession!.id}/events`),
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
      key: 'operator',
      header: t('operator'),
      render: (row) => <IdentityCell name={row.user_display_name} id={row.user_id} />,
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
      key: 'terminal',
      header: t('terminal'),
      render: (row) => <IdentityCell name={row.terminal_name ?? row.terminal_code} id={row.terminal_id} secondary={row.terminal_code} />,
    },
    {
      key: 'opened_at',
      header: t('openedAt'),
      render: (row) => <AuditValue value={formatDateTime(row.opened_at)} actor={row.opened_by_display_name} />,
    },
    {
      key: 'paused_at',
      header: t('pausedAt'),
      render: (row) => <AuditValue value={formatDateTime(row.paused_at)} actor={row.paused_by_display_name} reason={row.pause_reason} />,
    },
    {
      key: 'closed_at',
      header: t('closedAt'),
      render: (row) => <AuditValue value={formatDateTime(row.closed_at)} actor={row.closed_by_display_name} reason={row.close_reason} />,
    },
    {
      key: 'force_closed_at',
      header: t('forceClosedAt'),
      render: (row) => <AuditValue value={formatDateTime(row.force_closed_at)} actor={row.force_closed_by_display_name} reason={row.force_close_reason} />,
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
      key: 'metadata',
      header: t('metadata'),
      render: (row) => <JsonPreview value={row.metadata} />,
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      align: 'right',
      render: (row) => (
        <div className="flex gap-2">
          <CmxButton size="sm" variant="outline" onClick={() => setSummarySessionId(row.id)}>
            {t('viewSummary')}
          </CmxButton>
          <CmxButton size="sm" variant="outline" onClick={() => setEventsSession(row)}>
            {t('viewEvents')}
          </CmxButton>
        </div>
      ),
    },
  ];

  const eventColumns: CmxDataTableSimpleColumn<PosSessionEventListRow>[] = [
    { key: 'event_type', header: t('eventType'), render: (row) => row.event_type },
    { key: 'previous_status', header: t('previousStatus'), render: (row) => row.previous_status ?? t('none') },
    { key: 'new_status', header: t('newStatus'), render: (row) => row.new_status ?? t('none') },
    { key: 'event_at', header: t('eventAt'), render: (row) => formatDateTime(row.event_at) },
    { key: 'performed_by', header: t('performedBy'), render: (row) => <IdentityCell name={row.performed_by_display_name} id={row.performed_by} /> },
    { key: 'reason', header: t('reason'), render: (row) => row.reason ?? t('none') },
    { key: 'source_channel', header: t('sourceChannel'), render: (row) => row.source_channel ?? t('none') },
    { key: 'metadata', header: t('metadata'), render: (row) => <JsonPreview value={row.metadata} /> },
  ];

  const sessions = sessionsQuery.data?.items ?? [];
  const total = sessionsQuery.data?.total ?? 0;
  const activeTerminalLabel = activeSessionContext?.terminal_name
    ? [activeSessionContext.terminal_name, activeSessionContext.terminal_code].filter(Boolean).join(' · ')
    : activeSession?.terminal_id ?? null;
  const resetFilters = () => {
    setPage(1);
    setBranchId('');
    setStatus('');
    setScope('own');
    setSessionNo('');
    setOperatorQuery('');
    setTerminalQuery('');
    setCashDrawerQuery('');
    setBusinessDateFrom('');
    setBusinessDateTo('');
    setOpenedAtFrom('');
    setOpenedAtTo('');
  };

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
                {/* Vertical label/value rows: values wrap instead of truncating, and the list
                    scrolls within a capped height so new fields never grow the card. */}
                <dl className="grid max-h-44 overflow-y-auto rounded-lg border sm:grid-cols-2 border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,248_250_252))]">
                  <InfoRow label={t('status')}>
                    <CmxStatusBadge
                      label={activeSession.status}
                      variant={statusVariant(activeSession.status)}
                      size="sm"
                    />
                  </InfoRow>
                  <InfoRow label={t('sessionNo')} value={activeSession.session_no} copyValue={activeSession.session_no} />
                  <InfoRow label={t('businessDate')} value={activeSession.business_date} />
                  <InfoRow label={t('branch')} value={sessionDisplayBranch(activeSession)} />
                  <InfoRow label={t('openedAt')} value={formatDateTime(activeSession.opened_at)} />
                  <InfoRow
                    label={t('terminal')}
                    value={activeTerminalLabel ?? t('none')}
                    copyValue={activeSessionContext?.terminal_code ?? activeSession.terminal_id}
                  />
                  <InfoRow
                    label={t('cashDrawer')}
                    value={activeSessionContext?.cash_drawer_name ?? activeSession.cash_drawer_id ?? t('none')}
                    copyValue={activeSession.cash_drawer_id}
                  />
                  <InfoRow
                    label={t('drawerSession')}
                    value={activeSessionContext?.cash_drawer_session_no ?? activeSession.cash_drawer_session_id ?? t('none')}
                    copyValue={activeSessionContext?.cash_drawer_session_no ?? activeSession.cash_drawer_session_id}
                  >
                    {activeSessionContext?.cash_drawer_session_status ? (
                      <Badge variant={activeSessionContext.cash_drawer_session_status === 'OPEN' ? 'success' : 'secondary'}>
                        {activeSessionContext.cash_drawer_session_status}
                      </Badge>
                    ) : null}
                  </InfoRow>
                </dl>
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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <CmxInput
              label={t('sessionNo')}
              placeholder={t('searchSession')}
              value={sessionNo}
              onChange={(event) => { setPage(1); setSessionNo(event.target.value); }}
            />
            <CmxInput
              label={t('operator')}
              placeholder={t('allOperators')}
              value={operatorQuery}
              onChange={(event) => { setPage(1); setOperatorQuery(event.target.value); }}
            />
            <CmxInput
              label={t('terminal')}
              placeholder={t('allTerminals')}
              value={terminalQuery}
              onChange={(event) => { setPage(1); setTerminalQuery(event.target.value); }}
            />
            <CmxInput
              label={t('cashDrawer')}
              placeholder={t('allCashDrawers')}
              value={cashDrawerQuery}
              onChange={(event) => { setPage(1); setCashDrawerQuery(event.target.value); }}
            />
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
            <CmxInput
              label={t('fromBusinessDate')}
              type="date"
              value={businessDateFrom}
              onChange={(event) => { setPage(1); setBusinessDateFrom(event.target.value); }}
            />
            <CmxInput
              label={t('toBusinessDate')}
              type="date"
              value={businessDateTo}
              onChange={(event) => { setPage(1); setBusinessDateTo(event.target.value); }}
            />
            <CmxInput
              label={t('fromOpenedDate')}
              type="date"
              value={openedAtFrom}
              onChange={(event) => { setPage(1); setOpenedAtFrom(event.target.value); }}
            />
            <CmxInput
              label={t('toOpenedDate')}
              type="date"
              value={openedAtTo}
              onChange={(event) => { setPage(1); setOpenedAtTo(event.target.value); }}
            />
            <div className="flex items-end">
              <CmxButton className="w-full" variant="outline" onClick={resetFilters}>
                {t('resetFilters')}
              </CmxButton>
            </div>
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
            scrollable={false}
            tableClassName="min-w-[1800px]"
            stickyEndColumnIds={['actions']}
            auditConfig={{
              enabled: true,
              getTitle: (row) => `${t('sessionAudit')} · ${row.session_no}`,
              actionLabel: t('audit'),
              getExtras: (row) => [
                { key: 'sessionId', label: t('sessionId'), value: row.id },
                { key: 'active', label: t('active'), value: String(row.is_active) },
                { key: 'metadata', label: t('metadata'), value: <JsonPreview value={row.metadata} /> },
              ],
            }}
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
              <SummaryTile title={t('summary.payments')} totals={summaryQuery.data.payments.totals} rowsLabel={t('summary.rows')} />
              <SummaryTile title={t('summary.refunds')} totals={summaryQuery.data.refunds.totals} rowsLabel={t('summary.rows')} />
              <SummaryTile title={t('summary.voucherLines')} totals={summaryQuery.data.voucherLines.totals} rowsLabel={t('summary.rows')} />
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

      <CmxDialog open={!!eventsSession} onOpenChange={(open) => !open && setEventsSession(null)}>
        <CmxDialogContent className="max-w-6xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('events')}</CmxDialogTitle>
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('eventsDescription')}</p>
          </CmxDialogHeader>
          <CmxDataTable
            columns={eventColumns}
            data={eventsQuery.data?.items ?? []}
            loading={eventsQuery.isLoading}
            currentPage={eventsQuery.data?.page ?? 1}
            pageSize={eventsQuery.data?.pageSize ?? 50}
            total={eventsQuery.data?.total ?? 0}
            emptyStateTitle={t('events')}
            emptyStateDescription={t('eventsDescription')}
            tableClassName="min-w-[1300px]"
            scrollable={false}
            auditConfig={{
              enabled: true,
              getTitle: () => t('eventAudit'),
              actionLabel: t('audit'),
              getExtras: (row) => [
                { key: 'idempotencyKey', label: t('idempotencyKey'), value: row.idempotency_key ?? t('none') },
                { key: 'metadata', label: t('metadata'), value: <JsonPreview value={row.metadata} /> },
                { key: 'active', label: t('active'), value: String(row.is_active) },
              ],
            }}
          />
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setEventsSession(null)}>
              {t('cancel')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}

function IdentityCell({ name, id, secondary }: { name: string | null | undefined; id: string | null | undefined; secondary?: string | null }) {
  return (
    <div className="min-w-36 space-y-1">
      <div className="font-medium">{name ?? id ?? '-'}</div>
      {secondary && secondary !== name ? <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{secondary}</div> : null}
      {id ? <div className="font-mono text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{id.slice(0, 8)}</div> : null}
    </div>
  );
}

function AuditValue({ value, actor, reason }: { value: string; actor?: string | null; reason?: string | null }) {
  return (
    <div className="min-w-40 space-y-1">
      <div>{value}</div>
      {actor ? <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{actor}</div> : null}
      {reason ? <div className="max-w-48 truncate text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]" title={reason}>{reason}</div> : null}
    </div>
  );
}

function JsonPreview({ value }: { value: unknown }) {
  const json = JSON.stringify(value ?? {});
  return <div className="max-w-52 truncate font-mono text-xs" title={json}>{json}</div>;
}

/**
 * One label/value row of the active-session card. Values wrap (`break-all`)
 * rather than truncate so long identifiers stay fully readable; when
 * `copyValue` is set, a copy button places it on the clipboard.
 */
function InfoRow({
  label,
  value,
  copyValue,
  children,
}: {
  label: string;
  value?: string;
  copyValue?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[rgb(var(--cmx-border-rgb,226_232_240))] px-3 py-2">
      <dt className="w-32 shrink-0 pt-0.5 text-xs font-medium uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
        {value !== undefined ? <span className="min-w-0 break-all">{value}</span> : null}
        {children}
        {copyValue ? <CopyValueButton value={copyValue} label={label} /> : null}
      </dd>
    </div>
  );
}

function CopyValueButton({ value, label }: { value: string; label: string }) {
  const t = useTranslations('posSessions');
  const tCommon = useTranslations('common');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      cmxMessage.success(tCommon('copied'));
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      cmxMessage.error(t('messages.copyFailed'));
    }
  };

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={t('copyValue', { field: label })}
      title={t('copyValue', { field: label })}
      className="shrink-0 rounded p-1 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] hover:bg-[rgb(var(--cmx-border-rgb,226_232_240))] hover:text-[rgb(var(--cmx-foreground-rgb,15_23_42))] focus-visible:outline focus-visible:outline-2"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

/**
 * A4-1 (POS Session & Cash Drawer Hardening) — `totals` is one row per
 * currency, not a single ambiguous figure (the previous `GROUP BY
 * currency_code ... LIMIT 1` query silently dropped every currency but
 * one). A single-currency session (the common case, D14) renders exactly
 * as before: one amount, one count. A genuinely mixed-currency session
 * lists each currency's amount and count as its own line within the same
 * tile, so the categories stay aligned in the surrounding 3-column grid.
 */
function SummaryTile({
  title,
  totals,
  rowsLabel,
}: {
  title: string;
  totals: Array<{ amount: string; currencyCode: string | null; count: number }>;
  rowsLabel: string;
}) {
  const { formatMoneyWithCode: formatMoney } = useTenantCurrency();
  const rows = totals.length > 0 ? totals : [{ amount: 0, currencyCode: null, count: 0 }];
  return (
    <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
      <div className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{title}</div>
      {rows.map((row, i) => (
        <div key={row.currencyCode ?? `unknown-${i}`} className={i > 0 ? 'mt-3 border-t pt-3' : undefined}>
          <div className="mt-2 text-2xl font-bold">{formatMoney(row.amount, row.currencyCode)}</div>
          <div className="mt-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{row.count} {rowsLabel}</div>
        </div>
      ))}
    </div>
  );
}
