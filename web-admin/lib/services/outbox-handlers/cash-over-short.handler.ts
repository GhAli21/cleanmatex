import 'server-only';

import type { Prisma } from '@prisma/client';
import { postOverShortFromEventTx, type OverShortVariance } from '@/lib/services/cash-over-short.service';
import type { DomainEventRow } from '@/lib/types/domain-event';

interface CashOverShortPayload {
  session_id?: string;
  drawer_id?: string;
  branch_id?: string;
  phase?: 'OPENING' | 'CLOSING';
  variances?: Array<{ currencyCode?: string; varianceAmount?: string | number }>;
}

/**
 * CLF §4B.9 — the `cash_over_short` reaction to `CASH_DRAWER_VARIANCE_RECORDED`, emitted by
 * `cash-drawer-session.service.ts` at open/finalize/approve, and posts the
 * actual recognition voucher(s) via `postOverShortFromEventTx`. Each
 * currency in the payload is independently idempotent, so a redelivery
 * never double-posts.
 * @param tx the reaction transaction
 * @param event event row with event_type === 'CASH_DRAWER_VARIANCE_RECORDED'
 */
export async function processCashOverShortEvent(tx: Prisma.TransactionClient, event: DomainEventRow): Promise<void> {
  const payload = (event.payload ?? {}) as CashOverShortPayload;

  if (!payload.session_id || !payload.drawer_id || !payload.branch_id || !payload.phase || !payload.variances?.length) {
    throw new Error(`CASH_DRAWER_VARIANCE_RECORDED event ${event.id} payload missing required fields`);
  }

  const variances: OverShortVariance[] = payload.variances
    .filter((v): v is { currencyCode: string; varianceAmount: string | number } => !!v.currencyCode && v.varianceAmount != null)
    .map((v) => ({ currencyCode: v.currencyCode, varianceAmount: v.varianceAmount }));

  await postOverShortFromEventTx(
    tx,
    { tenantOrgId: event.tenant_org_id, userId: 'system' },
    {
      sessionId: payload.session_id as string,
      drawerId: payload.drawer_id as string,
      branchId: payload.branch_id as string,
      phase: payload.phase as 'OPENING' | 'CLOSING',
      variances,
    },
  );
}
