'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErpLitePhase10Service } from '@/lib/services/erp-lite-phase10.service';

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

function getRequiredNumber(formData: FormData, key: string): number {
  const value = Number(getRequiredString(formData, key));
  if (Number.isNaN(value)) {
    throw new Error(`Invalid number field: ${key}`);
  }
  return value;
}

function getOptionalNumber(formData: FormData, key: string): number | null {
  const raw = getOptionalString(formData, key);
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid number field: ${key}`);
  }
  return value;
}

function redirectBranchPl(notice?: string, error?: string) {
  const params = new URLSearchParams();
  if (notice) params.set('notice', notice);
  if (error) params.set('error', error);
  const suffix = params.toString();
  redirect(`/dashboard/erp-lite/branch-pl${suffix ? `?${suffix}` : ''}`);
}

export async function createErpLiteAllocationRuleAction(formData: FormData) {
  try {
    await ErpLitePhase10Service.createAllocationRule({
      rule_code: getOptionalString(formData, 'rule_code'),
      name: getRequiredString(formData, 'name'),
      name2: getOptionalString(formData, 'name2'),
      basis_code: getRequiredString(formData, 'basis_code') as
        | 'REVENUE'
        | 'WEIGHT'
        | 'PIECES'
        | 'ORDERS'
        | 'MANUAL',
      effective_from: getOptionalString(formData, 'effective_from'),
    });
  } catch (error) {
    redirectBranchPl(undefined, error instanceof Error ? error.message : 'allocation-rule-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/branch-pl');
  redirectBranchPl('allocation-rule-created');
}

export async function createErpLiteAllocationRunAction(formData: FormData) {
  try {
    await ErpLitePhase10Service.createAllocationRun({
      run_date: getRequiredString(formData, 'run_date'),
    });
  } catch (error) {
    redirectBranchPl(undefined, error instanceof Error ? error.message : 'allocation-run-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/branch-pl');
  redirectBranchPl('allocation-run-created');
}

export async function addErpLiteAllocationRunLineAction(formData: FormData) {
  try {
    await ErpLitePhase10Service.addAllocationRunLine({
      alloc_run_id: getRequiredString(formData, 'alloc_run_id'),
      alloc_rule_id: getOptionalString(formData, 'alloc_rule_id'),
      source_branch_id: getOptionalString(formData, 'source_branch_id'),
      target_branch_id: getRequiredString(formData, 'target_branch_id'),
      source_amount: getRequiredNumber(formData, 'source_amount'),
      alloc_amount: getRequiredNumber(formData, 'alloc_amount'),
    });
  } catch (error) {
    redirectBranchPl(undefined, error instanceof Error ? error.message : 'allocation-line-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/branch-pl');
  redirectBranchPl('allocation-line-created');
}

export async function postErpLiteAllocationRunAction(formData: FormData) {
  try {
    await ErpLitePhase10Service.postAllocationRun(getRequiredString(formData, 'alloc_run_id'));
  } catch (error) {
    redirectBranchPl(undefined, error instanceof Error ? error.message : 'allocation-run-post-failed');
  }

  revalidatePath('/dashboard/erp-lite/branch-pl');
  redirectBranchPl('allocation-run-posted');
}

export async function createErpLiteCostComponentAction(formData: FormData) {
  try {
    await ErpLitePhase10Service.createCostComponent({
      comp_code: getOptionalString(formData, 'comp_code'),
      name: getRequiredString(formData, 'name'),
      name2: getOptionalString(formData, 'name2'),
      cost_class_code: getRequiredString(formData, 'cost_class_code') as 'DIRECT' | 'INDIRECT',
      basis_code: getRequiredString(formData, 'basis_code') as
        | 'WEIGHT'
        | 'PIECES'
        | 'ORDERS'
        | 'REVENUE'
        | 'MANUAL',
    });
  } catch (error) {
    redirectBranchPl(undefined, error instanceof Error ? error.message : 'cost-component-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/branch-pl');
  redirectBranchPl('cost-component-created');
}

export async function createErpLiteCostRunAction(formData: FormData) {
  try {
    await ErpLitePhase10Service.createCostRun({
      run_date: getRequiredString(formData, 'run_date'),
    });
  } catch (error) {
    redirectBranchPl(undefined, error instanceof Error ? error.message : 'cost-run-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/branch-pl');
  redirectBranchPl('cost-run-created');
}

export async function addErpLiteCostRunDetailAction(formData: FormData) {
  try {
    await ErpLitePhase10Service.addCostRunDetail({
      cost_run_id: getRequiredString(formData, 'cost_run_id'),
      cost_comp_id: getRequiredString(formData, 'cost_comp_id'),
      branch_id: getOptionalString(formData, 'branch_id'),
      basis_value: getOptionalNumber(formData, 'basis_value'),
      alloc_amount: getRequiredNumber(formData, 'alloc_amount'),
      unit_cost: getOptionalNumber(formData, 'unit_cost'),
      total_cost: getRequiredNumber(formData, 'total_cost'),
    });
  } catch (error) {
    redirectBranchPl(undefined, error instanceof Error ? error.message : 'cost-run-detail-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/branch-pl');
  redirectBranchPl('cost-run-detail-created');
}

export async function postErpLiteCostRunAction(formData: FormData) {
  try {
    await ErpLitePhase10Service.postCostRun(getRequiredString(formData, 'cost_run_id'));
  } catch (error) {
    redirectBranchPl(undefined, error instanceof Error ? error.message : 'cost-run-post-failed');
  }

  revalidatePath('/dashboard/erp-lite/branch-pl');
  redirectBranchPl('cost-run-posted');
}
