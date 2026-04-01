'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErpLiteCoaService } from '@/lib/services/erp-lite-coa.service';

function getRequiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value.trim();
}

function getOptionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function redirectCoa(notice?: string, error?: string) {
  const params = new URLSearchParams();
  if (notice) params.set('notice', notice);
  if (error) params.set('error', error);
  const suffix = params.toString();
  redirect(`/dashboard/erp-lite/coa${suffix ? `?${suffix}` : ''}`);
}

export async function createErpLiteAccountAction(formData: FormData) {
  try {
    await ErpLiteCoaService.createAccount({
      account_code: getRequiredString(formData, 'account_code'),
      name: getRequiredString(formData, 'name'),
      name2: getOptionalString(formData, 'name2'),
      acc_type_id: getRequiredString(formData, 'acc_type_id'),
      acc_group_id: getOptionalString(formData, 'acc_group_id'),
      parent_account_id: getOptionalString(formData, 'parent_account_id'),
      branch_id: getOptionalString(formData, 'branch_id'),
      description: getOptionalString(formData, 'description'),
      description2: getOptionalString(formData, 'description2'),
      is_postable: getOptionalString(formData, 'is_postable') !== 'false',
    });
  } catch (error) {
    redirectCoa(undefined, error instanceof Error ? error.message : 'coa-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/coa');
  redirectCoa('account-created');
}
