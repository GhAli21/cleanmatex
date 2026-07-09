'use client';

import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';

interface CashDrawerApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

export interface CashDrawerWithCurrentSession {
  id: string;
  tenant_org_id: string;
  branch_id: string | null;
  drawer_code: string;
  drawer_name: string;
  drawer_name2: string | null;
  drawer_type: string;
  currency_code: string;
  requires_session: boolean;
  opening_float_required: boolean;
  max_cash_limit: number | null;
  assigned_terminal_id: string | null;
  is_active: boolean;
  rec_status: number;
  currentSession: {
    id: string;
    session_no: string;
    opened_at: string | null;
    opening_float_amount: number;
  } | null;
}

export interface CashDrawerOpenSessionResult {
  id: string;
  tenant_org_id: string;
  branch_id: string;
  cash_drawer_id: string;
  session_no: string;
  status: string;
  currency_code: string;
  opening_float_amount: number | string;
}

export interface CashDrawerSessionCloseSummary {
  session: {
    id: string;
    session_no: string;
    status: string;
    opened_at: string | null;
    opening_float_amount: number | string | null;
    currency_code: string | null;
  };
  movements: Array<{
    id: string;
    direction: string | null;
    movement_type: string | null;
    amount: number | string | null;
  }>;
  payments: Array<{
    id: string;
    amount: number | string | null;
    currency_code: string | null;
    payment_status?: string | null;
  }>;
  totalCashIn: number | string | null;
  totalCashOut: number | string | null;
  totalPayments: number | string | null;
  reconciliation?: {
    openingFloat: number | string | null;
    cashCollected: number | string | null;
    movementCashIn: number | string | null;
    movementCashOut: number | string | null;
    movementNet: number | string | null;
    expectedCash: number | string | null;
    movementExpectedCash: number | string | null;
    paymentCount: number;
    movementCount: number;
    currencyCode: string | null;
  };
}

export interface CashDrawerClosePreview {
  openingFloat: number;
  cashCollected: number;
  expectedCash: number;
  movementCashIn: number;
  movementCashOut: number;
  movementNet: number;
  countedCash: number | null;
  variance: number | null;
  currencyCode: string | null;
  paymentCount: number;
  movementCount: number;
}

/**
 * Lists active cash drawers with their current OPEN session for a branch.
 */
export async function fetchCashDrawersWithCurrentSession(
  branchId?: string | null
): Promise<CashDrawerWithCurrentSession[]> {
  const params = new URLSearchParams();
  if (branchId) params.set('branchId', branchId);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchCashDrawerJson<CashDrawerWithCurrentSession[]>(`/api/v1/cash-drawers${suffix}`);
}

/**
 * Opens a cash drawer session through the cash-drawer API boundary.
 */
export async function openCashDrawerSession(input: {
  drawerId: string;
  openingBalance: number;
  notes?: string;
  csrfToken: string | null;
}): Promise<CashDrawerOpenSessionResult> {
  const response = await fetch(`/api/v1/cash-drawers/${input.drawerId}/open-session`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCSRFHeader(input.csrfToken),
    },
    body: JSON.stringify({
      openingBalance: input.openingBalance,
      notes: input.notes || undefined,
    }),
  });
  return parseCashDrawerResponse<CashDrawerOpenSessionResult>(response);
}

/**
 * Loads drawer-session totals from the cash-drawer API boundary.
 */
export async function fetchCashDrawerSessionCloseSummary(
  drawerId: string,
  sessionId: string
): Promise<CashDrawerSessionCloseSummary> {
  const response = await fetch(`/api/v1/cash-drawers/${drawerId}/session/${sessionId}/summary`, {
    credentials: 'include',
  });
  return parseCashDrawerResponse<CashDrawerSessionCloseSummary>(response);
}

async function fetchCashDrawerJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  return parseCashDrawerResponse<T>(response);
}

async function parseCashDrawerResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as CashDrawerApiEnvelope<T>;

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  if (!payload.data) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return payload.data as T;
}

/**
 * Builds the close preview shown before calling the cash-drawer close API.
 *
 * Why:
 * POS Session only orchestrates the flow; all drawer numbers come from the
 * cash-drawer summary endpoint so drawer reconciliation stays in its own domain.
 */
export function buildCashDrawerClosePreview(
  summary: CashDrawerSessionCloseSummary,
  countedCashInput: string
): CashDrawerClosePreview {
  const reconciliation = summary.reconciliation;
  const openingFloat = toAmount(reconciliation?.openingFloat ?? summary.session.opening_float_amount);
  const cashCollected = toAmount(reconciliation?.cashCollected ?? summary.totalPayments);
  const movementCashIn = toAmount(reconciliation?.movementCashIn ?? summary.totalCashIn);
  const movementCashOut = toAmount(reconciliation?.movementCashOut ?? summary.totalCashOut);
  const expectedCash = toAmount(reconciliation?.expectedCash ?? openingFloat + cashCollected);
  const countedCash = parseCountedCash(countedCashInput);

  return {
    openingFloat,
    cashCollected,
    expectedCash,
    movementCashIn,
    movementCashOut,
    movementNet: movementCashIn - movementCashOut,
    countedCash,
    variance: countedCash == null ? null : countedCash - expectedCash,
    currencyCode: reconciliation?.currencyCode ?? summary.session.currency_code ?? summary.payments[0]?.currency_code ?? null,
    paymentCount: reconciliation?.paymentCount ?? summary.payments.length,
    movementCount: reconciliation?.movementCount ?? summary.movements.length,
  };
}

function toAmount(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseCountedCash(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
