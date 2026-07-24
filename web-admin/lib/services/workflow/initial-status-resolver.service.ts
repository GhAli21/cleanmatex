import 'server-only';

import { prisma } from '@/lib/db/prisma';

export interface ResolveInitialStatusParams {
  orderSourceCode?: string | null;
  orderTypeId?: string | null;
  isRetail?: boolean | null;
}

export interface ResolveInitialStatusResult {
  initialStatus: string;
  ruleCode: string | null;
}

const FALLBACK_STATUS = 'intake';

type InitialRuleRow = {
  rule_code: string;
  order_source_code: string | null;
  order_type_id: string | null;
  is_retail: boolean | null;
  initial_status: string;
  priority: number;
};

/**
 * Resolve create-time operational status from `sys_wf_initial_rules_cd`.
 * Lower priority wins. Null matchers are wildcards.
 * Retail must never resolve to `closed` (V1.0 ADR).
 */
export async function resolveInitialStatus(
  params: ResolveInitialStatusParams,
): Promise<ResolveInitialStatusResult> {
  let rules: InitialRuleRow[] = [];
  try {
    rules = await prisma.$queryRaw<InitialRuleRow[]>`
      SELECT
        rule_code,
        order_source_code,
        order_type_id,
        is_retail,
        initial_status,
        priority
      FROM public.sys_wf_initial_rules_cd
      WHERE COALESCE(is_active, true) = true
      ORDER BY priority ASC, rule_code ASC
    `;
  } catch {
    return { initialStatus: FALLBACK_STATUS, ruleCode: null };
  }

  const source = params.orderSourceCode?.trim() || null;
  const typeId = params.orderTypeId?.trim() || null;
  const isRetail = params.isRetail ?? null;

  for (const rule of rules) {
    if (rule.order_source_code != null && rule.order_source_code !== source) {
      continue;
    }
    if (rule.order_type_id != null && rule.order_type_id !== typeId) {
      continue;
    }
    if (rule.is_retail != null && rule.is_retail !== isRetail) {
      continue;
    }

    const status = (rule.initial_status ?? '').trim().toLowerCase();
    if (!status || status === 'closed') {
      continue;
    }

    return { initialStatus: status, ruleCode: rule.rule_code };
  }

  return { initialStatus: FALLBACK_STATUS, ruleCode: null };
}
