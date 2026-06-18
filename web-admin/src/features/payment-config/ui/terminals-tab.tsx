'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Monitor } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { CmxSwitch } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxEmptyState } from '@ui/data-display';
import { CmxSkeletonTable } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { CmxConfirmDialog } from '@ui/feedback';
import type { OrgPaymentTerminal } from '@/lib/types/payment';
import { toggleTerminalEnabled, softDeleteTerminal } from '@/app/actions/payment-config/terminals-actions';
import { TerminalFormDialog } from './terminal-form-dialog';
import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';

interface TerminalsTabProps {
  terminals: OrgPaymentTerminal[];
  branches: Array<{ id: string; branch_name: string }>;
  isLoading?: boolean;
  onRefresh: () => void;
}

/**
 *
 * @param root0
 * @param root0.terminals
 * @param root0.branches
 * @param root0.isLoading
 * @param root0.onRefresh
 */
export function TerminalsTab({ terminals, branches, isLoading, onRefresh }: TerminalsTabProps) {
  const t = useTranslations('paymentConfig');
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<OrgPaymentTerminal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgPaymentTerminal | null>(null);
  const [localEnabled, setLocalEnabled] = useState<Record<string, boolean>>({});

  const getEnabled = (t: OrgPaymentTerminal) =>
    localEnabled[t.id] !== undefined ? localEnabled[t.id] : t.is_enabled;
  const branchNameById = new Map(branches.map((branch) => [branch.id, branch.branch_name]));

  const CopyValue = ({
    value,
    maxLength,
  }: {
    value: string | number | null | undefined;
    maxLength?: number;
  }) => (
    <CmxCopyableCell
      as="span"
      value={value}
      maxLength={maxLength}
      align="left"
      className="px-0 py-0 text-sm text-foreground"
    />
  );

  const handleToggle = (terminal: OrgPaymentTerminal, val: boolean) => {
    setLocalEnabled((prev) => ({ ...prev, [terminal.id]: val }));
    startTransition(async () => {
      const result = await toggleTerminalEnabled(terminal.id, val);
      if (!result.success) {
        setLocalEnabled((prev) => ({ ...prev, [terminal.id]: !val }));
        cmxMessage.error(result.error ?? 'Failed to toggle terminal');
      }
    });
  };

  const handleDeactivate = async () => {
    if (!deleteTarget) return;
    const result = await softDeleteTerminal(deleteTarget.id);
    if (result.success) {
      cmxMessage.success(t('terminals.saved'));
      onRefresh();
    } else {
      cmxMessage.error(result.error ?? t('common.error'));
    }
    setDeleteTarget(null);
  };

  if (isLoading) return <CmxSkeletonTable rows={3} columns={5} showHeader />;

  if (!terminals.length) {
    return (
      <>
        <div className="mb-4 flex justify-end">
          <CmxButton onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 me-2" />
            {t('terminals.add')}
          </CmxButton>
        </div>
        <CmxEmptyState icon={<Monitor className="h-8 w-8" />} title={t('terminals.empty.title')} />
        <TerminalFormDialog
          branches={branches}
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); onRefresh(); }}
        />
      </>
    );
  }

  const columns = [
    {
      key: 'code',
      header: t('terminals.code'),
      render: (term: OrgPaymentTerminal) => <CopyValue value={term.terminal_code} />,
    },
    {
      key: 'name',
      header: t('terminals.name'),
      render: (term: OrgPaymentTerminal) => (
        <div>
          <div>{term.terminal_name}</div>
          {term.terminal_name2 && <div className="text-xs text-muted-foreground">{term.terminal_name2}</div>}
        </div>
      ),
    },
    {
      key: 'type',
      header: t('terminals.type'),
      render: (term: OrgPaymentTerminal) => <Badge variant="outline">{t(`terminals.terminalType.${term.terminal_type}` as never)}</Badge>,
    },
    {
      key: 'gateway',
      header: t('terminals.gateway'),
      render: (term: OrgPaymentTerminal) => term.gateway_code ? <Badge>{term.gateway_code}</Badge> : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'branch',
      header: t('terminals.branch'),
      render: (term: OrgPaymentTerminal) => (
        <div className="space-y-1 text-sm">
          <div className="font-medium">
            {term.branch_id ? (branchNameById.get(term.branch_id) ?? term.branch_id) : t('terminals.unassignedBranch')}
          </div>
          {term.branch_id && <CopyValue value={term.branch_id} maxLength={12} />}
        </div>
      ),
    },
    {
      key: 'deviceDetails',
      header: t('terminals.deviceDetails'),
      render: (term: OrgPaymentTerminal) => (
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">{t('terminals.serialNo')}</span>{' '}
            <span className="font-medium">{term.serial_no ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('terminals.merchantId')}</span>{' '}
            <span className="font-medium">{term.merchant_id ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('terminals.externalId')}</span>{' '}
            <span className="font-medium">{term.terminal_external_id ?? '—'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'is_enabled',
      header: t('terminals.enabled'),
      render: (term: OrgPaymentTerminal) => (
        <CmxSwitch checked={getEnabled(term)} onCheckedChange={(v) => handleToggle(term, v)} disabled={isPending} />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (term: OrgPaymentTerminal) => (
        <div className="flex gap-2 justify-end">
          <CmxButton variant="outline" size="sm" onClick={() => setEditTarget(term)}>{t('common.edit')}</CmxButton>
          <CmxButton variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(term)}>{t('common.deactivate')}</CmxButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <CmxButton onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 me-2" />
          {t('terminals.add')}
        </CmxButton>
      </div>
      <CmxDataTable columns={columns} data={terminals} />
      <TerminalFormDialog
        branches={branches}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { setShowCreate(false); onRefresh(); }}
      />
      {editTarget && (
        <TerminalFormDialog
          branches={branches}
          terminal={editTarget}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); onRefresh(); }}
        />
      )}
      <CmxConfirmDialog
        open={!!deleteTarget}
        title={t('terminals.deleteConfirm.title')}
        description={t('terminals.deleteConfirm.description')}
        confirmLabel={t('common.deactivate')}
        onConfirm={handleDeactivate}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
