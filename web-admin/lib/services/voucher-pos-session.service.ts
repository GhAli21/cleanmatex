import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { CASH_GATE_MODES } from '@/lib/constants/cash-drawer';
import { POS_SESSION_SURFACE } from '@/lib/constants/pos-session';
import { postAndWireBizVoucher } from '@/lib/services/voucher-wiring.service';
import type { PostAndWireResult } from '@/lib/types/voucher-wiring';
import { resolvePosSessionForFinanceTx } from '@/lib/services/pos-session.service';
import { financeTenderScopeOf } from '@/lib/utils/cash-method';

type Tx = Prisma.TransactionClient;

/**
 * Applies the MANUAL_VOUCHER POS-session policy to a draft finance voucher that is about to be
 * posted from the Finance → Vouchers screens (D62).
 *
 * The tender scope comes from the payment methods on the voucher's lines (a voucher with no
 * payment line is an accounting document, never blocked). The actor's own open session is linked
 * to every draft line that has none; when the tenant/branch requires a session for this tender
 * and the actor has none, the post is refused with `POS_SESSION_REQUIRED` (the caller's
 * transaction rolls back). Lines that already carry a session are left untouched.
 *
 * @param tx the posting transaction (the lines are still DRAFT, so they may be stamped)
 * @param input tenant, acting user and the voucher about to be posted
 * @returns the linked POS session id, or null when none applies
 * @throws PosSessionError POS_SESSION_REQUIRED / POS_SESSION_MISMATCH / POS_SESSION_BRANCH_CONFLICT
 * @example
 * await applyManualVoucherPosSessionTx(tx, { tenantId, userId, voucherId });
 */
export async function applyManualVoucherPosSessionTx(
  tx: Tx,
  input: { tenantId: string; userId: string; voucherId: string }
): Promise<string | null> {
  const voucher = await tx.org_fin_vouchers_mst.findFirst({
    where: { id: input.voucherId, tenant_org_id: input.tenantId },
    select: { branch_id: true },
  });
  if (!voucher) return null;

  const lines = await tx.org_fin_voucher_trx_lines_dtl.findMany({
    where: { tenant_org_id: input.tenantId, voucher_id: input.voucherId },
    select: { payment_method_code: true },
  });

  const session = await resolvePosSessionForFinanceTx(tx, {
    tenantId: input.tenantId,
    userId: input.userId,
    branchId: voucher.branch_id ?? null,
    surface: POS_SESSION_SURFACE.MANUAL_VOUCHER,
    tenderScope: financeTenderScopeOf(lines.map((line) => line.payment_method_code)),
  });
  if (!session) return null;

  await tx.org_fin_voucher_trx_lines_dtl.updateMany({
    where: {
      tenant_org_id: input.tenantId,
      voucher_id: input.voucherId,
      line_status: 'DRAFT',
      pos_session_id: null,
    },
    data: { pos_session_id: session.id, updated_by: input.userId },
  });
  return session.id;
}

/**
 * Posts a draft finance voucher from the Finance → Vouchers screens with the MANUAL_VOUCHER
 * POS-session policy applied in the SAME transaction as the post. One implementation shared by
 * the API route and the server action so the two entry points can never drift apart.
 *
 * @param tenantId tenant of the authenticated user
 * @param userId acting user
 * @param voucherId the draft voucher to post
 * @param idempotencyKey optional client key for a replay-safe post
 * @returns the post-and-wire result
 * @throws PosSessionError when the policy requires a session the user does not have
 */
export async function postManualVoucherWithPosPolicy(
  tenantId: string,
  userId: string,
  voucherId: string,
  idempotencyKey?: string
): Promise<PostAndWireResult> {
  return withTenantContext(tenantId, () =>
    prisma.$transaction(async (tx) => {
      await applyManualVoucherPosSessionTx(tx, { tenantId, userId, voucherId });
      return postAndWireBizVoucher(tenantId, voucherId, userId, CASH_GATE_MODES.DEFERRED, idempotencyKey, tx);
    })
  );
}
