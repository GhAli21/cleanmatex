'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowLeft, FileText, RefreshCw, X } from 'lucide-react';
import { CmxButton, CmxInput, CmxSelect } from '@ui/primitives';
import { CmxDataTable, type CmxDataTableSimpleColumn } from '@ui/data-display';
import { CmxStatusBadge } from '@ui/feedback';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import type { PosShiftZArchiveRow } from '@/lib/types/pos-shift-report';
import { fetchPosShiftZArchive, posShiftZArchiveKey } from '@features/pos-sessions/api/pos-shift-report-api';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 400;
const POS_SESSIONS_PATH = '/dashboard/internal_fin/pos-sessions';

interface BranchOption {
  id: string;
  name?: string | null;
  branch_name?: string | null;
}

async function fetchBranches(): Promise<BranchOption[]> {
  const response = await fetch('/api/v1/branches', { credentials: 'include' });
  const payload = (await response.json().catch(() => ({}))) as { data?: BranchOption[] };
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return payload.data ?? [];
}

/** A variance is "off" when it is a non-zero amount; the string is only inspected, never reformatted. */
const isOff = (variance: string | null): boolean => variance !== null && Number(variance) !== 0;

/**
 * Z-report archive: every frozen shift report the actor may see, newest business day first, with
 * the figures an accountant scans for (sales, drawer variance, integrity) and a link to the full
 * report. Filters are server-side; the list never ships whole snapshots.
 */
export function PosShiftZArchiveScreen() {
  const t = useTranslations('posShiftReport');
  const tArchive = useTranslations('posShiftReport.archive');
  const tSessions = useTranslations('posSessions');
  const router = useRouter();
  const { formatMoneyWithCode } = useTenantCurrency();

  const [page, setPage] = useState(1);
  const [branchId, setBranchId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);

  const rangeInvalid = from !== '' && to !== '' && from > to;
  const filters = {
    page,
    pageSize: PAGE_SIZE,
    branchId: branchId || undefined,
    businessDateFrom: from || undefined,
    businessDateTo: to || undefined,
    query: debouncedSearch || undefined,
  };

  const branchesQuery = useQuery({ queryKey: ['pos-sessions', 'branches'], queryFn: fetchBranches });
  const archiveQuery = useQuery({
    queryKey: posShiftZArchiveKey(filters),
    queryFn: () => fetchPosShiftZArchive(filters),
    enabled: !rangeInvalid,
    placeholderData: (previous) => previous,
  });

  const branchOptions = [
    { value: '', label: tArchive('allBranches') },
    ...(branchesQuery.data ?? []).map((b) => ({ value: b.id, label: b.name ?? b.branch_name ?? b.id })),
  ];
  const hasFilters = branchId !== '' || from !== '' || to !== '' || search !== '';
  const clearFilters = () => {
    setBranchId('');
    setFrom('');
    setTo('');
    setSearch('');
    setPage(1);
  };

  const columns: CmxDataTableSimpleColumn<PosShiftZArchiveRow>[] = [
    {
      key: 'reportNo',
      header: tArchive('reportNo'),
      render: (row) => (
        <div className="space-y-1">
          <Link
            href={`${POS_SESSIONS_PATH}/${row.posSessionId}/report`}
            className="font-mono text-sm font-medium text-[rgb(var(--cmx-primary-rgb,14_165_233))] hover:underline"
          >
            {row.reportNo}
          </Link>
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{row.sessionNo ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'businessDate',
      header: t('businessDate'),
      render: (row) => (
        <div className="space-y-1">
          <div>{row.businessDate}</div>
          {row.autoClosed ? <CmxStatusBadge label={tArchive('autoClosed')} variant="warning" size="sm" /> : null}
        </div>
      ),
    },
    { key: 'branch', header: t('branch'), render: (row) => row.branchName ?? '—' },
    { key: 'operator', header: t('operator'), render: (row) => row.operatorName ?? '—' },
    {
      key: 'sales',
      header: tArchive('sales'),
      render: (row) =>
        row.sales.length === 0 ? (
          <span className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('none')}</span>
        ) : (
          <div className="space-y-0.5">
            {row.sales.map((s) => (
              <div key={s.currencyCode ?? 'none'} className="tabular-nums">
                {formatMoneyWithCode(s.amount, s.currencyCode)}
              </div>
            ))}
          </div>
        ),
    },
    {
      key: 'drawerVariance',
      header: tArchive('drawerVariance'),
      render: (row) => {
        if (row.drawerVariance.length === 0) {
          return <span className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{tArchive('noDrawer')}</span>;
        }
        return (
          <div className="space-y-1">
            {row.drawerVariance.map((v) => (
              <div
                key={v.currencyCode}
                className={`tabular-nums ${isOff(v.variance) ? 'font-semibold text-red-600' : ''}`}
              >
                {v.variance === null ? '—' : formatMoneyWithCode(v.variance, v.currencyCode)}
              </div>
            ))}
            {row.variancePending ? (
              <CmxStatusBadge label={tArchive('variancePending')} variant="warning" size="sm" />
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'closedAt',
      header: t('closedAt'),
      render: (row) =>
        new Intl.DateTimeFormat(undefined, {
          timeZone: row.businessTimezone,
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(row.closedAt)),
    },
    {
      key: 'integrity',
      header: tArchive('integrity'),
      render: (row) => (
        <CmxStatusBadge
          label={row.hashVerified ? tArchive('verified') : tArchive('altered')}
          variant={row.hashVerified ? 'success' : 'error'}
          size="sm"
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <CmxButton
          variant="ghost"
          size="sm"
          aria-label={`${tArchive('open')} ${row.reportNo}`}
          onClick={() => router.push(`${POS_SESSIONS_PATH}/${row.posSessionId}/report`)}
        >
          <FileText className="h-4 w-4" aria-hidden />
        </CmxButton>
      ),
    },
  ];

  const data = archiveQuery.data;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href={POS_SESSIONS_PATH} className="inline-block">
            <CmxButton variant="ghost" size="sm" className="mb-2 gap-1 rtl:flex-row-reverse">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
              {tSessions('title')}
            </CmxButton>
          </Link>
          <h1 className="text-3xl font-bold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{tArchive('title')}</h1>
          <p className="mt-1 max-w-3xl text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {tArchive('description')}
          </p>
        </div>
        <CmxButton variant="outline" onClick={() => archiveQuery.refetch()} disabled={archiveQuery.isFetching}>
          <RefreshCw className="me-2 h-4 w-4" aria-hidden />
          {tSessions('refresh')}
        </CmxButton>
      </div>

      <section className="space-y-3 rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1.5fr_1fr_1fr_auto]">
          <CmxInput
            label={tArchive('search')}
            type="search"
            value={search}
            placeholder={tArchive('searchPlaceholder')}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />
          <CmxSelect
            label={t('branch')}
            value={branchId}
            options={branchOptions}
            disabled={branchesQuery.isLoading}
            onChange={(event) => {
              setPage(1);
              setBranchId(event.target.value);
            }}
          />
          <CmxInput
            label={tArchive('fromDate')}
            type="date"
            value={from}
            onChange={(event) => {
              setPage(1);
              setFrom(event.target.value);
            }}
          />
          <CmxInput
            label={tArchive('toDate')}
            type="date"
            value={to}
            onChange={(event) => {
              setPage(1);
              setTo(event.target.value);
            }}
          />
          <div className="flex items-end">
            <CmxButton variant="ghost" onClick={clearFilters} disabled={!hasFilters}>
              <X className="me-2 h-4 w-4" aria-hidden />
              {tArchive('clearFilters')}
            </CmxButton>
          </div>
        </div>
        {rangeInvalid ? (
          <p role="alert" className="text-sm text-red-600">
            {tArchive('rangeInvalid')}
          </p>
        ) : null}
      </section>

      {archiveQuery.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">{tArchive('loadFailed')}</p>
          <CmxButton variant="outline" size="sm" onClick={() => archiveQuery.refetch()}>
            <RefreshCw className="me-2 h-4 w-4" aria-hidden />
            {tArchive('retry')}
          </CmxButton>
        </div>
      ) : (
        <CmxDataTable
          columns={columns}
          data={data?.items ?? []}
          loading={archiveQuery.isLoading}
          currentPage={page}
          pageSize={PAGE_SIZE}
          total={data?.total ?? 0}
          onPageChange={setPage}
          emptyStateTitle={tArchive('emptyTitle')}
          emptyStateDescription={tArchive('emptyDescription')}
          paginationFooter="auto"
          tableClassName="min-w-[1100px]"
        />
      )}
    </div>
  );
}
