'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Truck } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { CmxSwitch } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxEmptyState } from '@ui/data-display';
import { CmxSkeletonTable } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { CmxConfirmDialog } from '@ui/feedback';
import { CmxSummaryMessage } from '@ui/feedback';
import type { OrgDriver } from '@/lib/types/drivers';
import { getDrivers, toggleDriverActive } from '@/app/actions/drivers/drivers-actions';
import { getBranchesAction } from '@/app/actions/inventory/inventory-actions';
import { DriverFormDialog } from './driver-form-dialog';

interface Branch {
  id: string;
  branch_name: string;
}

/** Drivers master-data screen: list, create, edit, deactivate. */
export function DriversListScreen() {
  const t = useTranslations('drivers');
  const [isPending, startTransition] = useTransition();
  const [drivers, setDrivers] = useState<OrgDriver[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<OrgDriver | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgDriver | null>(null);

  const load = () => {
    setIsLoading(true);
    setLoadError(null);
    void Promise.all([getDrivers(), getBranchesAction()]).then(([driversResult, branchesResult]) => {
      if (driversResult.success && driversResult.data) {
        setDrivers(driversResult.data);
      } else if (!driversResult.success) {
        setLoadError(driversResult.error ?? t('common.error'));
      }
      if (branchesResult.success && branchesResult.data) {
        setBranches(branchesResult.data as Branch[]);
      }
      setIsLoading(false);
    });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial mount data fetch, mirrors payment-settings-page.tsx
    load();
  }, []);

  const handleToggle = (driver: OrgDriver, val: boolean) => {
    if (!val) {
      setDeleteTarget(driver);
      return;
    }
    startTransition(async () => {
      const result = await toggleDriverActive(driver.id, true);
      if (result.success) {
        cmxMessage.success(t('form.saved'));
        load();
      } else {
        cmxMessage.error(result.error ?? t('common.error'));
      }
    });
  };

  const handleDeactivate = async () => {
    if (!deleteTarget) return;
    const result = await toggleDriverActive(deleteTarget.id, false);
    if (result.success) {
      cmxMessage.success(t('form.saved'));
      load();
    } else {
      cmxMessage.error(result.error ?? t('common.error'));
    }
    setDeleteTarget(null);
  };

  const branchNameById = new Map(branches.map((branch) => [branch.id, branch.branch_name]));

  const header = (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Truck className="h-8 w-8 text-blue-600" aria-hidden />
        <h1 className="text-2xl font-bold text-gray-900">{t('allDriversTitle')}</h1>
      </div>
      <CmxButton onClick={() => setShowCreate(true)}>
        <Plus className="h-4 w-4 me-2" />
        {t('form.add')}
      </CmxButton>
    </div>
  );

  const dialogs = (
    <>
      <DriverFormDialog
        branches={branches}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { setShowCreate(false); load(); }}
      />
      {editTarget && (
        <DriverFormDialog
          branches={branches}
          driver={editTarget}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); load(); }}
        />
      )}
      <CmxConfirmDialog
        open={!!deleteTarget}
        title={t('deactivateConfirm.title')}
        description={
          deleteTarget?.hasActiveRoute
            ? t('deactivateConfirm.blockedDescription')
            : t('deactivateConfirm.description')
        }
        confirmLabel={t('common.deactivate')}
        onConfirm={handleDeactivate}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {header}
        <CmxSkeletonTable rows={4} columns={5} showHeader />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {header}
        <CmxSummaryMessage type="error" title={t('common.error')} items={[loadError]} />
      </div>
    );
  }

  if (!drivers.length) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {header}
        <CmxEmptyState icon={<Truck className="h-8 w-8" />} title={t('empty.title')} description={t('empty.description')} />
        {dialogs}
      </div>
    );
  }

  const columns = [
    {
      key: 'name',
      header: t('form.name'),
      render: (driver: OrgDriver) => (
        <div>
          <div className="font-medium">{driver.name}</div>
          {driver.name2 && <div className="text-xs text-muted-foreground">{driver.name2}</div>}
        </div>
      ),
    },
    {
      key: 'phone',
      header: t('form.phone'),
      render: (driver: OrgDriver) => driver.phone ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'vehicle',
      header: t('list.vehicle'),
      render: (driver: OrgDriver) => (
        <div className="space-y-1 text-sm">
          <div>{driver.vehicle_type ?? '—'}</div>
          {driver.vehicle_plate_no && <div className="font-mono text-xs text-muted-foreground">{driver.vehicle_plate_no}</div>}
        </div>
      ),
    },
    {
      key: 'branch',
      header: t('form.branch'),
      render: (driver: OrgDriver) =>
        driver.branch_id
          ? (branchNameById.get(driver.branch_id) ?? driver.branch_id)
          : <span className="text-muted-foreground">{t('form.unassignedBranch')}</span>,
    },
    {
      key: 'status',
      header: t('list.status'),
      render: (driver: OrgDriver) =>
        driver.hasActiveRoute ? <Badge>{t('list.onRoute')}</Badge> : <span className="text-muted-foreground">{t('list.available')}</span>,
    },
    {
      key: 'is_active',
      header: t('list.active'),
      render: (driver: OrgDriver) => (
        <CmxSwitch checked={driver.is_active} onCheckedChange={(v) => handleToggle(driver, v)} disabled={isPending} />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (driver: OrgDriver) => (
        <div className="flex justify-end gap-2">
          <CmxButton variant="outline" size="sm" onClick={() => setEditTarget(driver)}>{t('common.edit')}</CmxButton>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {header}
      <CmxDataTable columns={columns} data={drivers} />
      {dialogs}
    </div>
  );
}
