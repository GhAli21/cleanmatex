'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms';
import { cmxMessage } from '@ui/feedback';
import { createDriverSchema, updateDriverSchema, type CreateDriverFormValues } from '../model/driver-schema';
import { createDriver, updateDriver } from '@/app/actions/drivers/drivers-actions';
import type { OrgDriver } from '@/lib/types/drivers';

interface DriverFormDialogProps {
  driver?: OrgDriver;
  branches: Array<{ id: string; branch_name: string }>;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const NO_BRANCH_VALUE = '__no_branch__';

/** Create/edit dialog for a tenant driver. Only name is required. */
export function DriverFormDialog({ driver, branches, open, onClose, onSuccess }: DriverFormDialogProps) {
  const t = useTranslations('drivers');
  const [isPending, startTransition] = useTransition();
  const isEdit = !!driver;

  const form = useForm<CreateDriverFormValues>({
    resolver: zodResolver(isEdit ? updateDriverSchema : createDriverSchema) as Resolver<CreateDriverFormValues>,
    defaultValues: driver ? {
      name: driver.name,
      name2: driver.name2 ?? '',
      phone: driver.phone ?? '',
      vehicle_type: driver.vehicle_type ?? '',
      vehicle_plate_no: driver.vehicle_plate_no ?? '',
      license_no: driver.license_no ?? '',
      branch_id: driver.branch_id ?? undefined,
    } : {
      branch_id: undefined,
    },
  });

  const branchId = useWatch({ control: form.control, name: 'branch_id' });

  const handleSubmit = (values: CreateDriverFormValues) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateDriver(driver!.id, values)
        : await createDriver(values);
      if (result.success) {
        cmxMessage.success(t('form.saved'));
        form.reset();
        onSuccess();
      } else {
        cmxMessage.error(result.error ?? t('common.error'));
      }
    });
  };

  return (
    <CmxDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle>{isEdit ? t('form.editTitle') : t('form.addTitle')}</CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium">{t('form.name')}</label>
            <CmxInput {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">{t('form.name2')}</label>
            <CmxInput {...form.register('name2')} dir="rtl" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('form.phone')}</label>
            <CmxInput {...form.register('phone')} placeholder="+968 9xxxxxxx" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('form.branch')}</label>
            <CmxSelectDropdown
              value={branchId ?? NO_BRANCH_VALUE}
              onValueChange={(value) => form.setValue('branch_id', value === NO_BRANCH_VALUE ? undefined : value)}
            >
              <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                <CmxSelectDropdownItem value={NO_BRANCH_VALUE}>{t('form.unassignedBranch')}</CmxSelectDropdownItem>
                {branches.map((branch) => (
                  <CmxSelectDropdownItem key={branch.id} value={branch.id}>{branch.branch_name}</CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>
          <div>
            <label className="text-sm font-medium">{t('form.vehicleType')}</label>
            <CmxInput {...form.register('vehicle_type')} placeholder={t('form.vehicleTypePlaceholder')} />
          </div>
          <div>
            <label className="text-sm font-medium">{t('form.vehiclePlateNo')}</label>
            <CmxInput {...form.register('vehicle_plate_no')} className="font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('form.licenseNo')}</label>
            <CmxInput {...form.register('license_no')} className="font-mono" />
          </div>
          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose} disabled={isPending}>{t('common.cancel')}</CmxButton>
            <CmxButton type="submit" disabled={isPending}>{isPending ? t('common.saving') : t('common.save')}</CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
