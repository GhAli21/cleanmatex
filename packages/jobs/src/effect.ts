/**
 * Effect helper (DESIGN §5.4): makes an INTERNAL job safe to run any number of times.
 *
 * Call it first inside the handler's transaction, then do the domain writes in that same
 * transaction only when it returns true. A retry, expiry overlap, redrive or replay finds the key
 * already claimed and does nothing. The row is also the permanent audit of which job applied it.
 */
import type { PrismaTransactionLike } from 'pg-boss';
import { z } from 'zod';
import { zId } from './queues';

const EFFECT = z.strictObject({
  tenantOrgId: zId,
  /** Deterministic, for example `<queue>:<eventId>`. Matches the table CHECK (1–200 chars). */
  effectKey: z.string().trim().min(1).max(200),
  queueName: z.string().min(1),
  jobId: zId,
  /** Consumer app that applied the effect, for example `cmx-workers`. */
  appliedBy: z.string().min(1),
});
export type EffectClaim = z.infer<typeof EFFECT>;

/** Returns true when this call claimed the effect, false when an earlier run already applied it. */
export async function claimEffect(tx: PrismaTransactionLike, claim: EffectClaim): Promise<boolean> {
  const e = EFFECT.parse(claim);
  const rows = await tx.$queryRawUnsafe<unknown[]>(
    `INSERT INTO public.org_ops_job_effect_tr (tenant_org_id, effect_key, queue_name, job_id, created_by, created_info)
     VALUES ($1::uuid, $2, $3, $4::uuid, $5, 'claimEffect')
     ON CONFLICT (tenant_org_id, effect_key) DO NOTHING
     RETURNING 1`,
    e.tenantOrgId, e.effectKey, e.queueName, e.jobId, e.appliedBy,
  );
  return rows.length === 1;
}
