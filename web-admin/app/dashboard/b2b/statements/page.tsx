/**
 * B2B Statements List
 * Lists org_b2b_statements_mst for the tenant
 * Includes Overdue (Dunning) section for statements past due with balance > 0
 */

'use client';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle, CmxButton } from '@ui/primitives';
import { CmxDataTable, type CmxDataTableSimpleColumn } from '@ui/data-display/cmx-datatable';
import { CmxCrudPageShell } from '@ui/patterns/cmx-crud-page-shell';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';


import { createClient } from '@/lib/supabase/client';
import { AlertCircle } from 'lucide-react';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { B2B_B2B_STATEMENTS_ACCESS } from '@features/b2b/access/b2b-access'

/**
 *
 */
export default function B2BStatementsPage() {
  const t = useTranslations('b2b');
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id ?? null;

  const { data: overdueStatements } = useQuery({
    queryKey: ['b2b-overdue-statements', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/v1/b2b/overdue-statements');
      if (!res.ok) throw new Error('Failed to fetch overdue statements');
      const json = await res.json();
      return (json.data ?? []) as Array<{
        id: string;
        statementNo: string;
        customerId: string;
        dueDate: string;
        balanceAmount: number;
        daysOverdue: number;
        dunningLevel?: { days: number; action: string } | null;
      }>;
    },
    enabled: !!tenantId && !!currentTenant,
  });

  const { data: statements, isLoading } = useQuery({
    queryKey: ['b2b-statements', tenantId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('org_b2b_statements_mst')
        .select('id, statement_no, customer_id, period_from, period_to, due_date, total_amount, paid_amount, balance_amount, status_cd')
        .eq('tenant_org_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId && !!currentTenant,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const overdueColumns: CmxDataTableSimpleColumn<{
    id: string;
    statementNo: string;
    customerId: string;
    dueDate: string;
    balanceAmount: number;
    daysOverdue: number;
    dunningLevel?: { days: number; action: string } | null;
  }>[] = [
    {
      key: 'statementNo',
      header: t('statementNo') || 'Statement No',
      sortable: false,
      render: (s) => <bdi dir="ltr">{s.statementNo}</bdi>,
    },
    {
      key: 'dueDate',
      header: t('dueDate') || 'Due Date',
      sortable: false,
      render: (s) => (s.dueDate ? <bdi dir="ltr" className="tabular-nums">{new Date(s.dueDate).toLocaleDateString()}</bdi> : '—'),
    },
    {
      key: 'balanceAmount',
      header: t('balanceAmount') || 'Balance',
      align: 'end',
      sortable: false,
      render: (s) => (
        <span className="font-medium tabular-nums">
          {s.balanceAmount != null ? <bdi dir="ltr">{Number(s.balanceAmount).toLocaleString()}</bdi> : '—'}
        </span>
      ),
    },
    {
      key: 'daysOverdue',
      header: t('daysOverdue') || 'Days Overdue',
      align: 'end',
      sortable: false,
      render: (s) => <span className="text-warning-text tabular-nums">{s.daysOverdue}</span>,
    },
    {
      key: 'dunningAction',
      header: t('dunningAction') || 'Action',
      sortable: false,
      render: (s) =>
        s.dunningLevel ? (
          <span className="text-xs font-medium text-warning-text">
            {s.dunningLevel.days}d → {s.dunningLevel.action}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: t('actions') || 'Actions',
      align: 'end',
      sortable: false,
      render: (s) => (
        <CmxButton
          variant="outline"
          size="sm"
          onClick={() => window.location.assign(`/dashboard/b2b/statements/${s.id}`)}
        >
          {t('view') || 'View'}
        </CmxButton>
      ),
    },
  ];

  const statementColumns: CmxDataTableSimpleColumn<{
    id: string;
    statement_no: string;
    customer_id: string;
    period_from: string | null;
    period_to: string | null;
    due_date: string | null;
    total_amount: number | null;
    paid_amount: number | null;
    balance_amount: number | null;
    status_cd: string | null;
  }>[] = [
    {
      key: 'statement_no',
      header: t('statementNo') || 'Statement No',
      sortable: false,
      render: (s) => <bdi dir="ltr">{s.statement_no}</bdi>,
    },
    {
      key: 'period_from',
      header: t('periodFrom') || 'Period From',
      sortable: false,
      render: (s) => (s.period_from ? <bdi dir="ltr" className="tabular-nums">{new Date(s.period_from).toLocaleDateString()}</bdi> : '—'),
    },
    {
      key: 'period_to',
      header: t('periodTo') || 'Period To',
      sortable: false,
      render: (s) => (s.period_to ? <bdi dir="ltr" className="tabular-nums">{new Date(s.period_to).toLocaleDateString()}</bdi> : '—'),
    },
    {
      key: 'due_date',
      header: t('dueDate') || 'Due Date',
      sortable: false,
      render: (s) => (s.due_date ? <bdi dir="ltr" className="tabular-nums">{new Date(s.due_date).toLocaleDateString()}</bdi> : '—'),
    },
    {
      key: 'total_amount',
      header: t('totalAmount') || 'Total',
      align: 'end',
      sortable: false,
      render: (s) =>
        s.total_amount != null ? <bdi dir="ltr" className="tabular-nums">{Number(s.total_amount).toLocaleString()}</bdi> : '—',
    },
    {
      key: 'balance_amount',
      header: t('balanceAmount') || 'Balance',
      align: 'end',
      sortable: false,
      render: (s) =>
        s.balance_amount != null ? <bdi dir="ltr" className="tabular-nums">{Number(s.balance_amount).toLocaleString()}</bdi> : '—',
    },
    {
      key: 'actions',
      header: t('actions') || 'Actions',
      align: 'end',
      sortable: false,
      render: (s) => (
        <CmxButton
          variant="outline"
          size="sm"
          onClick={() => window.location.assign(`/dashboard/b2b/statements/${s.id}`)}
        >
          {t('view') || 'View'}
        </CmxButton>
      ),
    },
  ];

  return (
    <RequireAnyPermission permissions={B2B_B2B_STATEMENTS_ACCESS.page.permissions ?? []}>
      <CmxCrudPageShell title={t('statements') || 'Statements'}>
        {/* Overdue (Dunning) section */}
        {overdueStatements && overdueStatements.length > 0 && (
          <CmxCard className="border-warning-border bg-warning-bg/50">
            <CmxCardHeader>
              <CmxCardTitle className="flex items-center gap-2 text-warning-text">
                <AlertCircle className="h-5 w-5" />
                {t('overdueStatements') || 'Overdue Statements'}
              </CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="p-0">
              <CmxDataTable
                columns={overdueColumns}
                data={overdueStatements}
                auditConfig={false}
                scrollable={false}
                paginationFooter="never"
                className="border-0 shadow-none"
              />
            </CmxCardContent>
          </CmxCard>
        )}

        <CmxDataTable
          columns={statementColumns}
          data={statements ?? []}
          auditConfig={false}
          scrollable={false}
          paginationFooter="never"
          emptyStateDescription="No statements yet. Generate a statement from a B2B customer detail page."
          emptyStateAction={
            <CmxButton
              variant="primary"
              onClick={() => window.location.assign('/dashboard/b2b/customers')}
            >
              {t('goToCustomers') || 'Go to B2B Customers'}
            </CmxButton>
          }
        />
      </CmxCrudPageShell>
    </RequireAnyPermission>
  );
}
