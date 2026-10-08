'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Copy, CreditCard, FileText, RefreshCw, Search, ShieldAlert, UserPlus } from 'lucide-react';
import { CmxButton, CmxInput, Label } from '@ui/primitives';
import { CmxSelect } from '@ui/primitives';
import { CmxTextarea } from '@ui/primitives';
import { CmxListOfValuesDialog, type CmxListOfValuesDialogLabels } from '@ui/forms';
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
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useSessionLifecycleLabels } from '@/lib/hooks/use-session-lifecycle-labels';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { useAuth } from '@/lib/auth/auth-context';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import {
  fetchMyActivePosSession,
  fetchPosSessionSummary,
  fetchPosSessionUsers,
  PosSessionApiError,
  postOpenPosSessionForUser,
  postPosSessionLifecycleAction,
  postPosSessionRowAction,
  type PosSessionRowAction,
  type PosSessionUserOption,
} from '@features/pos-sessions/api/pos-session-api';
import { CashDrawerCloseWizard } from '@features/cash-drawers/ui/cash-drawer-close-wizard';
import { PosSessionDrawerLinker } from '@features/pos-sessions/ui/pos-session-drawer-linker';
import { PosSessionAttentionNotice, PosSessionFlagBadges } from '@features/pos-sessions/ui/pos-session-flags';
import { getPosSessionFlags, posSessionErrorKey } from '@features/pos-sessions/model/pos-session-flags';
import { needsDrawerSelection } from '@features/pos-sessions/model/pos-session-drawer-link';
import type {
  GetMyActivePosSessionResult,
  PosSessionListResult,
  PosSessionListRow,
  PosSessionEventListResult,
  PosSessionEventListRow,
  PosSessionFilterOption,
  PosSessionFilterOptionType,
  PosSessionFilterOptionsResult,
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

/** Row-level management action dialog state — targets an arbitrary session, own or another user's. */
interface RowActionDialogState {
  row: PosSessionListRow | null;
  action: PosSessionRowAction | null;
  reason: string;
}

interface OpenForUserDialogState {
  open: boolean;
  userId: string;
  userLabel: string;
  branchId: string;
  terminalId: string;
  /** Set once the session is created — switches the dialog to the optional drawer-link step. */
  createdSessionId: string | null;
}

const EMPTY_OPEN_FOR_USER_DIALOG: OpenForUserDialogState = {
  open: false,
  userId: '',
  userLabel: '',
  branchId: '',
  terminalId: '',
  createdSessionId: null,
};

type PosSessionLookupKind = Exclude<PosSessionFilterOptionType, 'cashDrawerSession'>;

/**
 * Operates the authenticated user's POS session and exposes authorized session history.
 *
 * The API derives tenant and own/all visibility server-side; this screen only sends
 * user-selected, bounded filters and lifecycle intent.
 */
export function PosSessionsScreen() {
  const t = useTranslations('posSessions');
  const tCommon = useTranslations('common');
  const lifecycle = useSessionLifecycleLabels();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token: csrfToken } = useCSRFToken();
  const canViewAll = useHasPermissionCode('pos_session:view_all');
  const canViewZArchive = useHasPermissionCode('pos_session:report_z');
  const canOpen = useHasPermissionCode('pos_session:open');
  const canPauseResume = useHasPermissionCode('pos_session:pause_resume');
  const canClose = useHasPermissionCode('pos_session:close');
  const canForceClose = useHasPermissionCode('pos_session:force_close');
  const canViewCashDrawer = useHasPermissionCode('cash_drawer:view');
  const canCloseCashDrawer = useHasPermissionCode('cash_drawer:close_session');
  const canOpenCashDrawer = useHasPermissionCode('cash_drawer:open_session');
  const canCloseOthers = useHasPermissionCode('pos_session:close_others');
  const canOpenOthers = useHasPermissionCode('pos_session:open_others');
  const canFullManageOthers = useHasPermissionCode('pos_session:full_manage_others');
  const canManageOthersClose = canCloseOthers || canFullManageOthers;
  const canManageOthersForceClose = (canCloseOthers && canForceClose) || canFullManageOthers;
  const canManageOthersOpen = canOpenOthers || canFullManageOthers;
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id ?? null;

  const [page, setPage] = useState(1);
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [scope, setScope] = useState<'own' | 'all'>('own');
  const [recordActivity, setRecordActivity] = useState<'active' | 'all'>('active');
  const [sessionNo, setSessionNo] = useState('');
  const [userId, setUserId] = useState('');
  const [terminalId, setTerminalId] = useState('');
  const [cashDrawerId, setCashDrawerId] = useState('');
  const [selectedLookupLabels, setSelectedLookupLabels] = useState<Partial<Record<PosSessionLookupKind, string>>>({});
  const [lookupKind, setLookupKind] = useState<PosSessionLookupKind | null>(null);
  const [businessDateFrom, setBusinessDateFrom] = useState('');
  const [businessDateTo, setBusinessDateTo] = useState('');
  const [openedAtFrom, setOpenedAtFrom] = useState('');
  const [openedAtTo, setOpenedAtTo] = useState('');
  const [openBranchId, setOpenBranchId] = useState('');
  const [actionDialog, setActionDialog] = useState<SessionActionDialogState>({ action: null, reason: '' });
  const [rowActionDialog, setRowActionDialog] = useState<RowActionDialogState>({ row: null, action: null, reason: '' });
  const [openForUserDialog, setOpenForUserDialog] = useState<OpenForUserDialogState>(EMPTY_OPEN_FOR_USER_DIALOG);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [drawerDialogOpen, setDrawerDialogOpen] = useState(false);
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
    queryKey: ['pos-sessions', 'list', page, branchId, status, scope, recordActivity, sessionNo, userId, terminalId, cashDrawerId, businessDateFrom, businessDateTo, openedAtFrom, openedAtTo],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        scope,
        recordState: recordActivity,
      });
      if (branchId) params.set('branchId', branchId);
      if (status) params.set('status', status);
      if (sessionNo.trim()) params.set('sessionNo', sessionNo.trim());
      if (userId) params.set('userId', userId);
      if (terminalId) params.set('terminalId', terminalId);
      if (cashDrawerId) params.set('cashDrawerId', cashDrawerId);
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

  const lookupOptionsQuery = useQuery({
    queryKey: ['pos-sessions', 'filter-options', lookupKind, scope, recordActivity],
    enabled: !!lookupKind,
    queryFn: () => {
      const params = new URLSearchParams({ type: lookupKind!, scope, recordState: recordActivity, pageSize: '100' });
      return fetchJson<PosSessionFilterOptionsResult>(`/api/v1/pos-sessions/filter-options?${params.toString()}`);
    },
  });

  const userPickerQueryResult = useQuery({
    queryKey: ['pos-sessions', 'users'],
    enabled: userPickerOpen,
    queryFn: () => fetchPosSessionUsers(),
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
      const errorKey = error instanceof PosSessionApiError ? posSessionErrorKey(error.errorCode) : null;
      cmxMessage.error(errorKey ? t(`errors.${errorKey}`) : error instanceof Error ? error.message : t('messages.actionFailed'));
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

  const runRowAction = useCallback(async (
    row: PosSessionListRow,
    action: PosSessionRowAction,
    reason: string
  ): Promise<'ok' | 'error'> => {
    setBusyAction(`row-${action}`);
    try {
      await postPosSessionRowAction(row.id, action, {
        csrfToken,
        reason: reason || undefined,
        sourceChannel: 'pos_session_workbench',
      });
      cmxMessage.success(action === 'force-close' ? t('messages.forceClosed') : t('messages.closed'));
      await refreshAll();
      await queryClient.invalidateQueries({ queryKey: ['pos-sessions', 'events', row.id] });
      return 'ok';
    } catch (error) {
      cmxMessage.error(error instanceof Error ? error.message : t('messages.actionFailed'));
      return 'error';
    } finally {
      setBusyAction(null);
    }
  }, [csrfToken, queryClient, refreshAll, t]);

  const openSessionForUser = useCallback(async () => {
    if (!openForUserDialog.userId || !openForUserDialog.branchId) {
      cmxMessage.error(t('messages.selectUserAndBranch'));
      return;
    }
    setBusyAction('open-others');
    try {
      const result = await postOpenPosSessionForUser({
        csrfToken,
        targetUserId: openForUserDialog.userId,
        branchId: openForUserDialog.branchId,
        terminalId: openForUserDialog.terminalId || undefined,
        sourceChannel: 'pos_session_workbench',
      });
      await refreshAll();
      if (result.type === 'BRANCH_CONFLICT') {
        cmxMessage.error(t('banner.branchConflict'));
        return;
      }
      cmxMessage.success(t('messages.openedForUser'));
      // Stay open on an optional drawer-link step instead of closing — the
      // session now exists, so the admin can finish provisioning the shift
      // in one flow, or skip and let the cashier link a drawer later.
      setOpenForUserDialog((current) => ({ ...current, createdSessionId: result.session.id }));
    } catch (error) {
      cmxMessage.error(error instanceof Error ? error.message : t('messages.actionFailed'));
    } finally {
      setBusyAction(null);
    }
  }, [openForUserDialog, csrfToken, refreshAll, t]);

  const handleDrawerFinalized = useCallback(async () => {
    cmxMessage.success(t('messages.drawerClosed'));
    setDrawerDialogOpen(false);
    await runLifecycleAction(
      actionDialog.action === 'force-close' ? 'force-close' : 'close',
      { reason: actionDialog.reason || undefined },
      actionDialog.action === 'force-close' ? t('messages.forceClosed') : t('messages.closed')
    );
    setActionDialog({ action: null, reason: '' });
  }, [actionDialog, runLifecycleAction, t]);

  const branchOptions = (branchesQuery.data ?? []).map((branch) => ({
    value: branch.id,
    label: branch.name ?? branch.branch_name ?? branch.id,
  }));

  const statusOptions = lifecycle.posStatusOptions;

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
      render: (row) => (
        <>
          <CmxStatusBadge label={lifecycle.posStatus(row.status)} variant={statusVariant(row.status)} size="sm" />
          <PosSessionFlagBadges session={row} />
        </>
      ),
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
              {row.cash_drawer_session_no} / {lifecycle.drawerStatus(row.cash_drawer_session_status)}
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
      render: (row) => {
        const isOwnRow = currentUserId !== null && row.user_id === currentUserId;
        const rowIsActive = row.status === POS_SESSION_STATUS.OPEN || row.status === POS_SESSION_STATUS.PAUSED;
        const canCloseRow = rowIsActive && (isOwnRow ? canClose : canManageOthersClose);
        const canForceCloseRow = rowIsActive && (isOwnRow ? canForceClose : canManageOthersForceClose);
        return (
          <div className="flex flex-wrap justify-end gap-2">
            <CmxButton size="sm" variant="outline" onClick={() => setSummarySessionId(row.id)}>
              {t('viewSummary')}
            </CmxButton>
            <CmxButton size="sm" variant="outline" onClick={() => setEventsSession(row)}>
              {t('viewEvents')}
            </CmxButton>
            <CmxButton
              size="sm"
              variant="outline"
              onClick={() => router.push(`/dashboard/internal_fin/pos-sessions/${row.id}/report`)}
            >
              {t('viewReport')}
            </CmxButton>
            {canCloseRow ? (
              <CmxButton
                size="sm"
                variant="outline"
                onClick={() => setRowActionDialog({ row, action: 'close', reason: '' })}
              >
                {t('close')}
              </CmxButton>
            ) : null}
            {canForceCloseRow ? (
              <CmxButton
                size="sm"
                variant="destructive"
                onClick={() => setRowActionDialog({ row, action: 'force-close', reason: '' })}
              >
                {t('forceClose')}
              </CmxButton>
            ) : null}
          </div>
        );
      },
    },
  ];

  const eventColumns: CmxDataTableSimpleColumn<PosSessionEventListRow>[] = [
    { key: 'event_type', header: t('eventType'), render: (row) => lifecycle.posEvent(row.event_type) },
    { key: 'previous_status', header: t('previousStatus'), render: (row) => (row.previous_status ? lifecycle.posStatus(row.previous_status) : t('none')) },
    { key: 'new_status', header: t('newStatus'), render: (row) => (row.new_status ? lifecycle.posStatus(row.new_status) : t('none')) },
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
  const activeSessionNeedsDrawer = activeSession
    ? needsDrawerSelection({
        cash_drawer_session_id: activeSession.cash_drawer_session_id,
        cash_drawer_session_status: activeSessionContext?.cash_drawer_session_status ?? null,
      })
    : false;
  const resetFilters = () => {
    setPage(1);
    setBranchId('');
    setStatus('');
    setScope('own');
    setRecordActivity('active');
    setSessionNo('');
    setUserId('');
    setTerminalId('');
    setCashDrawerId('');
    setSelectedLookupLabels({});
    setBusinessDateFrom('');
    setBusinessDateTo('');
    setOpenedAtFrom('');
    setOpenedAtTo('');
  };

  const lookupSelectedId = lookupKind === 'operator'
    ? userId
    : lookupKind === 'branch'
      ? branchId
    : lookupKind === 'terminal'
      ? terminalId
      : lookupKind === 'cashDrawer'
        ? cashDrawerId
        : null;

  const lookupLabels: CmxListOfValuesDialogLabels = {
    title: lookupKind ? t(lookupKind) : '',
    searchLabel: tCommon('search'),
    searchPlaceholder: tCommon('search'),
    loadingLabel: t('banner.loading'),
    emptyLabel: t('noFilterOptions'),
    clearLabel: tCommon('clear'),
    cancelLabel: tCommon('cancel'),
    applyLabel: tCommon('done'),
    optionsLabel: lookupKind ? t(lookupKind) : '',
  };

  const selectedLookupLabel = (kind: PosSessionLookupKind, selectedId: string, fallback: string) => {
    if (!selectedId) return fallback;
    return selectedLookupLabels[kind] ?? fallback;
  };

  const applyLookup = (selectedId: string | null) => {
    setPage(1);
    const selectedLabel = lookupOptionsQuery.data?.items.find((option) => option.id === selectedId)?.label;
    if (lookupKind) {
      setSelectedLookupLabels((current) => ({
        ...current,
        [lookupKind]: selectedLabel ?? '',
      }));
    }
    if (lookupKind === 'operator') setUserId(selectedId ?? '');
    if (lookupKind === 'branch') setBranchId(selectedId ?? '');
    if (lookupKind === 'terminal') setTerminalId(selectedId ?? '');
    if (lookupKind === 'cashDrawer') setCashDrawerId(selectedId ?? '');
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
        <div className="flex flex-wrap gap-2">
          {canManageOthersOpen ? (
            <CmxButton variant="outline" onClick={() => setOpenForUserDialog({ ...EMPTY_OPEN_FOR_USER_DIALOG, open: true })}>
              <UserPlus className="me-2 h-4 w-4" aria-hidden />
              {t('openForUser')}
            </CmxButton>
          ) : null}
          {canViewZArchive ? (
            <CmxButton variant="outline" onClick={() => router.push('/dashboard/internal_fin/pos-sessions/z-reports')}>
              <FileText className="me-2 h-4 w-4" aria-hidden />
              {t('zArchive')}
            </CmxButton>
          ) : null}
          <CmxButton variant="outline" onClick={refreshAll} disabled={sessionsQuery.isFetching || activeQuery.isFetching}>
            <RefreshCw className="me-2 h-4 w-4" aria-hidden />
            {t('refresh')}
          </CmxButton>
        </div>
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
                      label={lifecycle.posStatus(activeSession.status)}
                      variant={statusVariant(activeSession.status)}
                      size="sm"
                    />
                    <PosSessionFlagBadges session={activeSession} />
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
                  {!activeSessionNeedsDrawer ? (
                    <>
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
                          <Badge variant="success">{lifecycle.drawerStatus(activeSessionContext.cash_drawer_session_status)}</Badge>
                        ) : null}
                      </InfoRow>
                    </>
                  ) : null}
                </dl>
                {canViewCashDrawer && activeSessionNeedsDrawer ? (
                  activeSession.status === POS_SESSION_STATUS.OPEN ? (
                    <div className="space-y-3 rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
                      {activeSession.cash_drawer_session_id ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                          <p className="font-medium">{t('drawerSessionClosedTitle')}</p>
                          <p className="mt-1 text-amber-900">
                            {t('drawerSessionClosedDescription', {
                              drawer: activeSessionContext?.cash_drawer_name ?? t('none'),
                              sessionNo: activeSessionContext?.cash_drawer_session_no ?? t('none'),
                              status: activeSessionContext?.cash_drawer_session_status ?? t('none'),
                            })}
                          </p>
                        </div>
                      ) : null}
                      <PosSessionDrawerLinker
                        branchId={activeSession.branch_id}
                        posSessionId={activeSession.id}
                        canViewCashDrawer={canViewCashDrawer}
                        canOpenCashDrawer={canOpenCashDrawer}
                        onLinked={refreshAll}
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                      {t('hub.resumeBeforeDrawerLink')}
                    </div>
                  )
                ) : null}
                <PosSessionAttentionNotice session={activeSession} />
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
                  {canPauseResume && getPosSessionFlags(activeSession).canResume ? (
                    <CmxButton
                      variant="secondary"
                      loading={busyAction === 'resume'}
                      onClick={() => runLifecycleAction('resume', {}, t('messages.resumed'))}
                    >
                      {t('resume')}
                    </CmxButton>
                  ) : null}
                  <CmxButton
                    variant="outline"
                    onClick={() => router.push(`/dashboard/internal_fin/pos-sessions/${activeSession.id}/report`)}
                  >
                    {t('viewReport')}
                  </CmxButton>
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
        <CmxCardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CmxCardTitle>{t('historyTitle')}</CmxCardTitle>
            <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('historyDescription')}</p>
          </div>
          <CmxButton variant="outline" onClick={resetFilters}>
            {t('resetFilters')}
          </CmxButton>
        </CmxCardHeader>
        <CmxCardContent className="space-y-5">
          <section className="space-y-3 rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
            <div>
              <h3 className="text-sm font-semibold">{t('filterGroups.visibility')}</h3>
              <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('filterGroups.visibilityDescription')}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
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
                  // An all-scope lookup may be outside the caller's own-session view.
                  setBranchId('');
                  setUserId('');
                  setTerminalId('');
                  setCashDrawerId('');
                  setSelectedLookupLabels({});
                }}
              />
              <CmxSelect
                label={t('recordActivity')}
                value={recordActivity}
                options={[
                  { value: 'active', label: t('activeRecords') },
                  { value: 'all', label: t('allRecords') },
                ]}
                onChange={(event) => {
                  setPage(1);
                  setRecordActivity(event.target.value === 'all' ? 'all' : 'active');
                }}
              />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
            <h3 className="text-sm font-semibold">{t('filterGroups.session')}</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <CmxInput
              label={t('sessionNo')}
              placeholder={t('searchSession')}
              value={sessionNo}
              onChange={(event) => { setPage(1); setSessionNo(event.target.value); }}
            />
            <LookupFilterButton
              label={t('operator')}
              value={selectedLookupLabel('operator', userId, t('allOperators'))}
              onClick={() => setLookupKind('operator')}
            />
            <LookupFilterButton
              label={t('branch')}
              value={selectedLookupLabel('branch', branchId, t('optionalBranch'))}
              onClick={() => setLookupKind('branch')}
            />
            <LookupFilterButton
              label={t('terminal')}
              value={selectedLookupLabel('terminal', terminalId, t('allTerminals'))}
              onClick={() => setLookupKind('terminal')}
            />
            <LookupFilterButton
              label={t('cashDrawer')}
              value={selectedLookupLabel('cashDrawer', cashDrawerId, t('allCashDrawers'))}
              onClick={() => setLookupKind('cashDrawer')}
            />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
            <h3 className="text-sm font-semibold">{t('filterGroups.lifecycle')}</h3>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)]">
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
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            </div>
          </section>
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
          {lookupKind ? (
            <CmxListOfValuesDialog<PosSessionFilterOption>
              open
              onOpenChange={(open) => !open && setLookupKind(null)}
              options={lookupOptionsQuery.data?.items ?? []}
              selectedId={lookupSelectedId}
              onApply={applyLookup}
              getOptionId={(option) => option.id}
              getOptionLabel={(option) => option.label}
              getOptionDescription={(option) => option.secondaryLabel ?? option.label2}
              isLoading={lookupOptionsQuery.isLoading}
              labels={lookupLabels}
            />
          ) : null}
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

      <CmxDialog open={rowActionDialog.row !== null} onOpenChange={(open) => !open && setRowActionDialog({ row: null, action: null, reason: '' })}>
        <CmxDialogContent>
          <CmxDialogHeader>
            <CmxDialogTitle>
              {rowActionDialog.action === 'force-close' ? t('forceClose') : t('close')}
              {rowActionDialog.row ? ` · ${rowActionDialog.row.session_no}` : ''}
            </CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            {rowActionDialog.row && currentUserId !== null && rowActionDialog.row.user_id !== currentUserId ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <ShieldAlert className="me-2 inline h-4 w-4" aria-hidden />
                {t('messages.actingOnOtherUser', { operator: rowActionDialog.row.user_display_name ?? rowActionDialog.row.user_id })}
              </div>
            ) : null}
            {rowActionDialog.action === 'force-close' ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <ShieldAlert className="me-2 inline h-4 w-4" aria-hidden />
                {t('forceClose')}
              </div>
            ) : null}
            <CmxTextarea
              value={rowActionDialog.reason}
              placeholder={t('reason')}
              onChange={(event) => setRowActionDialog((current) => ({ ...current, reason: event.target.value }))}
            />
          </div>
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setRowActionDialog({ row: null, action: null, reason: '' })}>
              {t('cancel')}
            </CmxButton>
            <CmxButton
              variant={rowActionDialog.action === 'force-close' ? 'destructive' : 'primary'}
              disabled={rowActionDialog.action === 'force-close' && rowActionDialog.reason.trim().length === 0}
              loading={busyAction === `row-${rowActionDialog.action}`}
              onClick={() => {
                if (!rowActionDialog.row || !rowActionDialog.action) return;
                runRowAction(rowActionDialog.row, rowActionDialog.action, rowActionDialog.reason).then((result) => {
                  if (result === 'ok') {
                    setRowActionDialog({ row: null, action: null, reason: '' });
                  }
                });
              }}
            >
              {rowActionDialog.action === 'force-close' ? t('forceClose') : t('close')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={openForUserDialog.open} onOpenChange={(open) => !open && setOpenForUserDialog(EMPTY_OPEN_FOR_USER_DIALOG)}>
        <CmxDialogContent>
          <CmxDialogHeader>
            <CmxDialogTitle>{t('openForUser')}</CmxDialogTitle>
          </CmxDialogHeader>
          {openForUserDialog.createdSessionId ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                {t('messages.openedForUser')}
              </div>
              <PosSessionDrawerLinker
                branchId={openForUserDialog.branchId}
                posSessionId={openForUserDialog.createdSessionId}
                canViewCashDrawer={canViewCashDrawer}
                canOpenCashDrawer={canOpenCashDrawer}
                onLinked={refreshAll}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('operator')}</Label>
                <CmxButton
                  className="w-full justify-start text-start font-normal"
                  variant="outline"
                  onClick={() => setUserPickerOpen(true)}
                >
                  <span className="truncate">{openForUserDialog.userLabel || t('selectUser')}</span>
                  <Search className="ms-auto size-4 shrink-0 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]" aria-hidden />
                </CmxButton>
              </div>
              <CmxSelect
                label={t('branch')}
                placeholder={t('selectBranch')}
                value={openForUserDialog.branchId}
                options={branchOptions}
                disabled={branchesQuery.isLoading}
                onChange={(event) => setOpenForUserDialog((current) => ({ ...current, branchId: event.target.value }))}
              />
            </div>
          )}
          <CmxDialogFooter>
            {openForUserDialog.createdSessionId ? (
              <CmxButton variant="primary" onClick={() => setOpenForUserDialog(EMPTY_OPEN_FOR_USER_DIALOG)}>
                {t('hub.closePanel')}
              </CmxButton>
            ) : (
              <>
                <CmxButton variant="outline" onClick={() => setOpenForUserDialog(EMPTY_OPEN_FOR_USER_DIALOG)}>
                  {t('cancel')}
                </CmxButton>
                <CmxButton
                  variant="primary"
                  disabled={!openForUserDialog.userId || !openForUserDialog.branchId}
                  loading={busyAction === 'open-others'}
                  onClick={openSessionForUser}
                >
                  {t('openForUser')}
                </CmxButton>
              </>
            )}
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      {userPickerOpen ? (
        <CmxListOfValuesDialog<PosSessionUserOption>
          open
          onOpenChange={(open) => !open && setUserPickerOpen(false)}
          options={userPickerQueryResult.data?.items ?? []}
          selectedId={openForUserDialog.userId || null}
          onApply={(selectedId) => {
            const selected = userPickerQueryResult.data?.items.find((option) => option.id === selectedId);
            setOpenForUserDialog((current) => ({
              ...current,
              userId: selectedId ?? '',
              userLabel: selected?.label ?? '',
            }));
            setUserPickerOpen(false);
          }}
          getOptionId={(option) => option.id}
          getOptionLabel={(option) => option.label}
          getOptionDescription={(option) => option.secondaryLabel}
          isLoading={userPickerQueryResult.isLoading}
          labels={{
            title: t('operator'),
            searchLabel: tCommon('search'),
            searchPlaceholder: tCommon('search'),
            loadingLabel: t('banner.loading'),
            emptyLabel: t('noFilterOptions'),
            clearLabel: tCommon('clear'),
            cancelLabel: tCommon('cancel'),
            applyLabel: tCommon('done'),
            optionsLabel: t('operator'),
          }}
        />
      ) : null}

      {canViewCashDrawer && activeSession?.cash_drawer_id && activeSession.cash_drawer_session_id ? (
        <CashDrawerCloseWizard
          drawerId={activeSession.cash_drawer_id}
          sessionId={activeSession.cash_drawer_session_id}
          branchId={activeSession.branch_id ?? null}
          open={drawerDialogOpen}
          onOpenChange={setDrawerDialogOpen}
          onFinalized={handleDrawerFinalized}
        />
      ) : null}

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
 * Keeps lookup selection discoverable while the generic Cmx dialog owns the
 * searchable, keyboard-safe value list instead of duplicating picker logic per filter.
 */
function LookupFilterButton({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <CmxButton className="w-full justify-start text-start font-normal" variant="outline" onClick={onClick}>
        <span className="truncate">{value}</span>
        <Search className="ms-auto size-4 shrink-0 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]" aria-hidden />
      </CmxButton>
    </div>
  );
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
