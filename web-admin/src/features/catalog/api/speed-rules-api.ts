import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import type { SpeedRuleResolution, SpeedRuleView } from '@/lib/services/catalog/speed-rules.service';
import type { SpeedRuleBulkStatusInput, SpeedRuleCreateInput } from '@/lib/validations/speed-rule-schemas';

const BASE = '/api/v1/catalog/speed-rules';

/** A refused Speed Pricing request; `code` selects the message (`catalog.speedPricing.errors.<code>`). */
export class SpeedRulesApiError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

/** List filters, as the route reads them. */
export interface SpeedRuleFilters {
  serviceSpeed?: string;
  branchId?: string;
  serviceCategoryCode?: string;
  productId?: string;
  active?: 'true' | 'false';
}

const toQuery = (values: object) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return query.toString();
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init });
  const body = (await response.json().catch(() => null)) as { success?: boolean; data?: T; error?: { code?: string } | string } | null;
  if (!response.ok || !body?.success) {
    throw new SpeedRulesApiError((typeof body?.error === 'object' && body.error?.code) || 'INTERNAL_ERROR');
  }
  return body.data as T;
}

const send = <T>(url: string, method: string, csrfToken: string | null, payload?: unknown) =>
  request<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });

/**
 * One page of rules.
 * @param filters - list filters
 * @param page - page number, from 1
 * @param pageSize - rows per page
 * @param signal - cancels a superseded request
 */
export const fetchSpeedRules = (filters: SpeedRuleFilters, page: number, pageSize: number, signal?: AbortSignal) =>
  request<{ rows: SpeedRuleView[]; total: number }>(`${BASE}?${toQuery({ ...filters, page, pageSize })}`, { signal });

/**
 * Creates a rule.
 * @param rule - the rule
 * @param csrfToken - CSRF token
 */
export const createSpeedRuleApi = (rule: SpeedRuleCreateInput, csrfToken: string | null) =>
  send<SpeedRuleView>(BASE, 'POST', csrfToken, rule);

/**
 * Replaces a rule.
 * @param id - rule id
 * @param rule - the rule as it should be
 * @param csrfToken - CSRF token
 */
export const updateSpeedRuleApi = (id: string, rule: SpeedRuleCreateInput, csrfToken: string | null) =>
  send<SpeedRuleView>(`${BASE}/${id}`, 'PATCH', csrfToken, rule);

/**
 * Deletes a rule no order line used.
 * @param id - rule id
 * @param csrfToken - CSRF token
 */
export const deleteSpeedRuleApi = (id: string, csrfToken: string | null) =>
  send<{ deleted: boolean }>(`${BASE}/${id}`, 'DELETE', csrfToken);

/**
 * Creates one product rule per active product of the rule's category.
 * @param rule - the rule to copy, with the category
 * @param csrfToken - CSRF token
 */
export const bulkCreateSpeedRulesApi = (rule: SpeedRuleCreateInput, csrfToken: string | null) =>
  send<{ created: number; skipped: number; belowStandard: number }>(`${BASE}/bulk`, 'POST', csrfToken, rule);

/**
 * Retires or restores the product rules of a speed; `dryRun` only counts them.
 * @param input - the speed, the category, the new status and `dryRun`
 * @param csrfToken - CSRF token
 */
export const setProductRulesActiveApi = (input: SpeedRuleBulkStatusInput, csrfToken: string | null) =>
  send<{ matched: number; changed: number; generalRules: number }>(`${BASE}/bulk-status`, 'POST', csrfToken, input);

/**
 * Which rule applies to this row, and every rule that matched.
 * @param q - speed, product or category, branch, date
 */
export const resolveSpeedRuleApi = (q: { serviceSpeed: string; productId?: string; serviceCategoryCode?: string; branchId?: string; date?: string }) =>
  request<SpeedRuleResolution>(`${BASE}/resolve?${toQuery(q)}`);

/** A product as the picker shows it. */
export interface SpeedRuleProductOption {
  id: string;
  product_code: string;
  product_name: string | null;
  product_name2: string | null;
}

/**
 * Products for the picker, searched on the server.
 * @param search - name or code
 * @param signal - cancels a superseded search
 */
export const fetchSpeedRuleProducts = (search: string, signal?: AbortSignal) =>
  request<SpeedRuleProductOption[]>(`/api/v1/products?${toQuery({ search, limit: 50, status: 'active' })}`, { signal });

/** A category as the menus show it. */
export interface SpeedRuleCategoryOption {
  service_category_code: string;
  ctg_name: string;
  ctg_name2: string | null;
}

/**
 * The categories this organization enabled.
 * @param signal - cancels the request
 */
export const fetchSpeedRuleCategories = (signal?: AbortSignal) =>
  request<SpeedRuleCategoryOption[]>('/api/v1/categories?enabled=true', { signal });

/** A branch as the menus show it. */
export interface SpeedRuleBranchOption {
  id: string;
  name?: string | null;
  name2?: string | null;
  branch_name?: string | null;
  branch_name2?: string | null;
}

/**
 * The organization's branches. This route answers `{ data }` with no `success` flag.
 * @param signal - cancels the request
 */
export async function fetchSpeedRuleBranches(signal?: AbortSignal): Promise<SpeedRuleBranchOption[]> {
  const response = await fetch('/api/v1/branches', { credentials: 'include', signal });
  const body = (await response.json().catch(() => null)) as { data?: SpeedRuleBranchOption[] } | null;
  if (!response.ok || !Array.isArray(body?.data)) throw new SpeedRulesApiError('INTERNAL_ERROR');
  return body.data;
}
