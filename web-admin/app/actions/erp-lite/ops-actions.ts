'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErpLiteUsageMapService } from '@/lib/services/erp-lite-usage-map.service';
import { ErpLitePeriodsService } from '@/lib/services/erp-lite-periods.service';
import { ErpLiteExceptionsService } from '@/lib/services/erp-lite-exceptions.service';
import type { ResolveExceptionInput } from '@/lib/types/erp-lite-ops';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function getRequired(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value.trim();
}

function getOptional(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// -------------------------------------------------------
// Usage Map Actions
// -------------------------------------------------------

export async function createUsageMapAction(formData: FormData) {
  try {
    await ErpLiteUsageMapService.createUsageMap({
      usage_code_id: getRequired(formData, 'usage_code_id'),
      account_id: getRequired(formData, 'account_id'),
      branch_id: getOptional(formData, 'branch_id'),
      effective_from: getOptional(formData, 'effective_from'),
      effective_to: getOptional(formData, 'effective_to'),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create usage map';
    redirect(`/dashboard/erp-lite/usage-maps?error=${encodeURIComponent(message)}`);
  }
  revalidatePath('/dashboard/erp-lite/usage-maps');
  revalidatePath('/dashboard/erp-lite/readiness');
  redirect('/dashboard/erp-lite/usage-maps?notice=created');
}

export async function activateUsageMapAction(formData: FormData) {
  const mappingId = getRequired(formData, 'mapping_id');
  try {
    await ErpLiteUsageMapService.activateUsageMap(mappingId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to activate mapping';
    redirect(`/dashboard/erp-lite/usage-maps?error=${encodeURIComponent(message)}`);
  }
  revalidatePath('/dashboard/erp-lite/usage-maps');
  revalidatePath('/dashboard/erp-lite/readiness');
  redirect('/dashboard/erp-lite/usage-maps?notice=activated');
}

export async function deactivateUsageMapAction(formData: FormData) {
  const mappingId = getRequired(formData, 'mapping_id');
  try {
    await ErpLiteUsageMapService.deactivateUsageMap(mappingId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to deactivate mapping';
    redirect(`/dashboard/erp-lite/usage-maps?error=${encodeURIComponent(message)}`);
  }
  revalidatePath('/dashboard/erp-lite/usage-maps');
  revalidatePath('/dashboard/erp-lite/readiness');
  redirect('/dashboard/erp-lite/usage-maps?notice=deactivated');
}

// -------------------------------------------------------
// Period Actions
// -------------------------------------------------------

export async function createPeriodAction(formData: FormData) {
  try {
    await ErpLitePeriodsService.createPeriod({
      period_code: getRequired(formData, 'period_code'),
      name: getRequired(formData, 'name'),
      name2: getOptional(formData, 'name2'),
      description: getOptional(formData, 'description'),
      start_date: getRequired(formData, 'start_date'),
      end_date: getRequired(formData, 'end_date'),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create period';
    redirect(`/dashboard/erp-lite/periods?error=${encodeURIComponent(message)}`);
  }
  revalidatePath('/dashboard/erp-lite/periods');
  revalidatePath('/dashboard/erp-lite/readiness');
  redirect('/dashboard/erp-lite/periods?notice=created');
}

export async function closePeriodAction(formData: FormData) {
  const periodId = getRequired(formData, 'period_id');
  try {
    await ErpLitePeriodsService.closePeriod({
      period_id: periodId,
      lock_reason: getOptional(formData, 'lock_reason'),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to close period';
    redirect(`/dashboard/erp-lite/periods?error=${encodeURIComponent(message)}`);
  }
  revalidatePath('/dashboard/erp-lite/periods');
  revalidatePath('/dashboard/erp-lite/readiness');
  redirect('/dashboard/erp-lite/periods?notice=closed');
}

// -------------------------------------------------------
// Exception Actions
// -------------------------------------------------------

export async function resolveExceptionAction(formData: FormData) {
  const action = getRequired(formData, 'action') as ResolveExceptionInput['action'];
  const exceptionId = getRequired(formData, 'exception_id');
  try {
    await ErpLiteExceptionsService.resolveException({
      exception_id: exceptionId,
      resolution_notes: getRequired(formData, 'resolution_notes'),
      action,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update exception';
    redirect(`/dashboard/erp-lite/exceptions?error=${encodeURIComponent(message)}`);
  }
  revalidatePath('/dashboard/erp-lite/exceptions');
  revalidatePath('/dashboard/erp-lite/readiness');
  redirect('/dashboard/erp-lite/exceptions?notice=resolved');
}
