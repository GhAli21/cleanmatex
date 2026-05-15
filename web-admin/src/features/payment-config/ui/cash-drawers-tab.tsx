'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Inbox } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { Badge } from '@ui/primitives/badge';
import { CmxEmptyState } from '@ui/data-display';
import { CmxSkeletonTable } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { CmxConfirmDialog } from '@ui/feedback';
import type { OrgCashDrawer, OrgCashDrawerSession } from '@/lib/types/payment';
import { toggleCashDrawerActive } from '@/app/actions/payment-config/cash-drawers-actions';
import { CashDrawerFormDialog } from './cash-drawer-form-dialog';
import { CashDrawerSessionCard } from './cash-drawer-session-card';

interface CashDrawersTabProps {
  drawers: Array<OrgCashDrawer & { currentSession: OrgCashDrawerSession | null }>;
  isLoading?: boolean;
  onRefresh: () => void;
}

export function CashDrawersTab({ drawers, isLoading, onRefresh }: CashDrawersTabProps) {
  const t = useTranslations('paymentConfig');
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<OrgCashDrawer | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<OrgCashDrawer | null>(null);
  const [sessionTarget, setSessionTarget] = useState<(OrgCashDrawer & { currentSession: OrgCashDrawerSession | null }) | null>(null);

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    const result = await toggleCashDrawerActive(deactivateTarget.id, false);
    if (result.success) {
      cmxMessage.success(t('cashDrawers.deactivated'));
      onRefresh();
    } else {
      cmxMessage.error(result.error ?? t('common.error'));
    }
    setDeactivateTarget(null);
  };

  if (isLoading) return <CmxSkeletonTable rows={3} columns={5} showHeader />;

  if (!drawers.length) {
    return (
      <>
        <div className="mb-4 flex justify-end">
          <CmxButton onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 me-2" />
            {t('cashDrawers.add')}
          </CmxButton>
        </div>
        <CmxEmptyState icon={<Inbox className="h-8 w-8" />} title={t('cashDrawers.empty.title')} />
        <CashDrawerFormDialog open={showCreate} onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); onRefresh(); }} />
      </>
    );
  }

  const columns = [
    {
      key: 'name',
      header: t('cashDrawers.name'),
      render: (d: OrgCashDrawer & { currentSession: OrgCashDrawerSession | null }) => (
        <div>
          <div className="font-medium">{d.drawer_name}</div>
          {d.drawer_name2 && <div className="text-xs text-muted-foreground">{d.drawer_name2}</div>}
        </div>
      ),
    },
    {
      key: 'type',
      header: t('cashDrawers.drawerType'),
      render: (d: OrgCashDrawer & { currentSession: OrgCashDrawerSession | null }) => (
        <Badge variant="outline">{t(`cashDrawers.drawerTypeLabel.${d.drawer_type}` as never)}</Badge>
      ),
    },
    {
      key: 'currency',
      header: t('cashDrawers.currency'),
      render: (d: OrgCashDrawer & { currentSession: OrgCashDrawerSession | null }) => (
        <span className="font-mono text-sm">{d.currency_code}</span>
      ),
    },
    {
      key: 'session',
      header: t('cashDrawers.sessionStatus'),
      render: (d: OrgCashDrawer & { currentSession: OrgCashDrawerSession | null }) => {
        if (!d.currentSession) return <Badge variant="secondary">{t('cashDrawers.noOpenSession')}</Badge>;
        return (
          <Badge variant="default" className="bg-green-600">
            {t('cashDrawers.openSince', { time: new Date(d.currentSession.opened_at).toLocaleTimeString() })}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (d: OrgCashDrawer & { currentSession: OrgCashDrawerSession | null }) => (
        <div className="flex gap-2 justify-end">
          {d.currentSession && (
            <CmxButton variant="outline" size="sm" onClick={() => setSessionTarget(d)}>
              {t('cashDrawers.viewSession')}
            </CmxButton>
          )}
          <CmxButton variant="outline" size="sm" onClick={() => setEditTarget(d)}>{t('common.edit')}</CmxButton>
          <CmxButton variant="ghost" size="sm" className="text-destructive" onClick={() => setDeactivateTarget(d)}>{t('common.deactivate')}</CmxButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <CmxButton onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 me-2" />
          {t('cashDrawers.add')}
        </CmxButton>
      </div>
      <CmxDataTable columns={columns} data={drawers} rowKey="id" />
      <CashDrawerFormDialog open={showCreate} onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); onRefresh(); }} />
      {editTarget && (
        <CashDrawerFormDialog drawer={editTarget} open={!!editTarget} onClose={() => setEditTarget(null)} onSuccess={() => { setEditTarget(null); onRefresh(); }} />
      )}
      {sessionTarget?.currentSession && (
        <CashDrawerSessionCard
          session={sessionTarget.currentSession}
          drawer={sessionTarget}
          open={!!sessionTarget}
          onClose={() => setSessionTarget(null)}
        />
      )}
      <CmxConfirmDialog
        open={!!deactivateTarget}
        title={t('cashDrawers.deactivateConfirm.title')}
        description={t('cashDrawers.deactivateConfirm.description')}
        confirmLabel={t('common.deactivate')}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </>
  );
}
