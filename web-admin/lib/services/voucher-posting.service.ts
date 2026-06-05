/**
 * BVM Voucher Posting Service
 * Phase 1: finalizes a DRAFT voucher → POSTED.
 * Does NOT touch posting_status (managed by future GL service).
 * Does NOT wire lines to operational tables (wiring is a separate explicit phase).
 * Idempotent — same idempotency_key always returns the same result.
 */

import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';
import { withTenantContext } from '../db/tenant-context';
import { VOUCHER_STATUS } from '../constants/voucher';
import { validateStatusTransition, validateVoucherForPosting } from './voucher-validation.service';

export interface PostingResult {
  voucherId: string;
  voucher_no: string;
  voucher_status: string;
  fromCache: boolean;
}

/**
 * Post a BVM voucher: DRAFT → POSTED.
 * All steps run in a single Prisma transaction — full rollback on any failure.
 */
export async function postBizVoucher(
  tenantOrgId: string,
  voucherId: string,
  userId: string,
  idempotencyKey?: string
): Promise<PostingResult> {
  return withTenantContext(tenantOrgId, async () => {
    return prisma.$transaction(async (tx) => {
      const db = tx as typeof prisma;

      // 1. Idempotency check — return cached result if key already resolved
      if (idempotencyKey) {
        const existing = await db.org_idempotency_keys.findFirst({
          where: {
            tenant_org_id: tenantOrgId,
            key: idempotencyKey,
            resource_type: 'voucher_post',
          },
        });

        if (existing?.response_cache) {
          return {
            ...(existing.response_cache as Record<string, unknown>),
            fromCache: true,
          } as PostingResult;
        }
      }

      // 2. Lock the voucher header to serialize concurrent posts
      const vouchers = await db.$queryRaw<Array<{
        id: string;
        voucher_no: string;
        voucher_status: string;
        total_amount: string;
      }>>`
        SELECT id, voucher_no, voucher_status, total_amount
        FROM org_fin_vouchers_mst
        WHERE id = ${voucherId}::uuid
          AND tenant_org_id = ${tenantOrgId}::uuid
        FOR UPDATE
      `;

      const voucher = vouchers[0];
      if (!voucher) throw new Error(`Voucher ${voucherId} not found`);

      // 3. Assert DRAFT status
      validateStatusTransition(
        voucher.voucher_status as never,
        VOUCHER_STATUS.POSTED
      );

      // 4. Load active DRAFT lines
      const lines = await db.org_fin_voucher_trx_lines_dtl.findMany({
        where: { tenant_org_id: tenantOrgId, voucher_id: voucherId, is_active: true },
        select: { amount: true, line_status: true, is_active: true },
      });

      // 5. Full posting validation
      validateVoucherForPosting(Number(voucher.total_amount), lines as never[]);

      // 6. Recalculate total_amount from active line sum
      const recalcTotal = lines
        .filter(l => l.is_active && l.line_status === 'DRAFT')
        .reduce((sum, l) => sum + Number(l.amount), 0);

      const now = new Date();

      // 7. Mark voucher as POSTED
      // B8 fix (RESUME doc 2026-05-28): keep legacy `status` and wiring
      // `posting_status` in sync with `voucher_status` so the three columns
      // can't drift. (Prior comment said "do NOT touch posting_status" — that
      // was the source of the drift; posting_status='POSTED' is now correct.)
      await db.org_fin_vouchers_mst.updateMany({
        where: { id: voucherId, tenant_org_id: tenantOrgId },
        data: {
          voucher_status: VOUCHER_STATUS.POSTED,
          posting_status: 'POSTED',
          total_amount:   recalcTotal,
          paid_amount:    recalcTotal,
          outstanding_amount: 0,
          posted_at:      now,
          posted_by:      userId,
          updated_at:     now,
          updated_by:     userId,
        },
      });

      // 8. Mark all active DRAFT lines as POSTED; wiring_status stays NOT_WIRED
      await db.org_fin_voucher_trx_lines_dtl.updateMany({
        where: { tenant_org_id: tenantOrgId, voucher_id: voucherId, line_status: 'DRAFT', is_active: true },
        data: { line_status: 'POSTED', updated_at: now, updated_by: userId },
      });

      // 9. Write domain event outbox
      await db.org_domain_events_outbox.create({
        data: {
          tenant_org_id:  tenantOrgId,
          event_type:     'VOUCHER_POSTED',
          aggregate_type: 'fin_voucher',
          aggregate_id:   voucherId,
          payload:        {
            voucher_id:     voucherId,
            voucher_no:     voucher.voucher_no,
            voucher_status: VOUCHER_STATUS.POSTED,
            total_amount:   recalcTotal,
            posted_by:      userId,
            posted_at:      now.toISOString(),
          },
        },
      });

      // 10. Write audit log
      await db.org_fin_voucher_audit_log.create({
        data: {
          voucher_id:        voucherId,
          tenant_org_id:     tenantOrgId,
          action:            'POSTED',
          changed_by:        userId,
          changed_at:        now,
          snapshot_or_reason: JSON.stringify({
            voucher_status: VOUCHER_STATUS.POSTED,
            total_amount:   recalcTotal,
          }),
        },
      });

      const result: PostingResult = {
        voucherId,
        voucher_no:     voucher.voucher_no,
        voucher_status: VOUCHER_STATUS.POSTED,
        fromCache:      false,
      };

      // 11. Upsert idempotency key as resolved
      if (idempotencyKey) {
        await db.org_idempotency_keys.upsert({
          where: {
            tenant_org_id_key_resource_type: {
              tenant_org_id: tenantOrgId,
              key:           idempotencyKey,
              resource_type: 'voucher_post',
            },
          },
          create: {
            tenant_org_id:  tenantOrgId,
            key:            idempotencyKey,
            resource_type:  'voucher_post',
            resource_id:    voucherId,
            response_cache: result as unknown as Prisma.InputJsonValue,
            created_at:     now,
            expires_at:     new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
          update: {
            response_cache: result as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return result;
    });
  });
}
