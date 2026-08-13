/**
 * B28 follow-up #5 — real concurrency proof for `claimIdempotencyKey`'s
 * atomic `INSERT ... ON CONFLICT DO NOTHING RETURNING id` claim.
 *
 * The unit tests for `stakeAmendmentIdempotency` mock this function entirely,
 * so they verify the *mapping* of each claim status to an
 * AmendmentGovernanceError — not that the claim itself is genuinely atomic.
 * Only a real Postgres unique index can demonstrate that, and only under real
 * concurrency: this file fires N simultaneous claims for the same key against
 * the live local DB and asserts that exactly one wins.
 *
 * This is the property the whole hardening rests on. The previous
 * `stakeIdempotencyHash` (upsert, then read back) could not provide it —
 * every concurrent caller observed `resourceId: null` and proceeded, which on
 * a money-bearing path means two edit-history rows and two financial deltas
 * for one logical amendment.
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import {
  claimIdempotencyKey,
  storeIdempotencyHash,
  deleteIdempotencyHash,
} from '@/lib/utils/idempotency';

const RESOURCE_TYPE = 'b28_claim_concurrency_test';

let dbUp = false;
let tenantId = '';

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const tenants = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst ORDER BY created_at LIMIT 1`;
    tenantId = tenants[0]?.id ?? '';
    dbUp = tenantId.length > 0;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  if (dbUp) {
    // Belt-and-braces: every test cleans its own key, but a failed assertion
    // can skip that, and this resource_type is exclusive to this file.
    await prisma.$executeRaw`
      DELETE FROM public.org_idempotency_keys WHERE resource_type = ${RESOURCE_TYPE}`
      .catch(() => { /* best-effort */ });
  }
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[idempotency-claim-concurrency] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('claimIdempotencyKey — real atomic claim under concurrency (B28 follow-up #5)', () => {
  dbit('exactly one of 8 simultaneous claims for the same key+payload wins; the rest see IN_FLIGHT', async () => {
    const key = `claim-${randomUUID()}`;
    const hash = 'payload-hash-A';
    try {
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          claimIdempotencyKey(tenantId, key, RESOURCE_TYPE, hash),
        ),
      );

      const claimed = results.filter((r) => r.status === 'CLAIMED');
      const inFlight = results.filter((r) => r.status === 'IN_FLIGHT');

      // The core safety property. Under the old read-then-write stake every
      // one of these 8 would have been told to proceed.
      expect(claimed).toHaveLength(1);
      expect(inFlight).toHaveLength(7);

      // And the DB holds exactly one row — no duplicate-key explosion, and no
      // silently swallowed insert.
      const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(*) AS n FROM public.org_idempotency_keys
        WHERE tenant_org_id = ${tenantId}::uuid AND key = ${key} AND resource_type = ${RESOURCE_TYPE}`;
      expect(Number(rows[0].n)).toBe(1);
    } finally {
      await deleteIdempotencyHash(tenantId, key, RESOURCE_TYPE);
    }
  });

  dbit('once the winner completes, a later call with the same key+payload replays instead of re-running', async () => {
    const key = `claim-${randomUUID()}`;
    const hash = 'payload-hash-B';
    const resourceId = randomUUID();
    try {
      const first = await claimIdempotencyKey(tenantId, key, RESOURCE_TYPE, hash);
      expect(first.status).toBe('CLAIMED');

      // Simulates the caller finishing its work and attaching the artifact —
      // exactly what completeAmendmentIdempotency does with the edit-history id.
      await storeIdempotencyHash(tenantId, key, RESOURCE_TYPE, hash, resourceId);

      const replay = await claimIdempotencyKey(tenantId, key, RESOURCE_TYPE, hash);
      expect(replay).toEqual({ status: 'COMPLETED', resourceId });
    } finally {
      await deleteIdempotencyHash(tenantId, key, RESOURCE_TYPE);
    }
  });

  dbit('a different payload on the same key is a CONFLICT, both while in-flight and after completion', async () => {
    const key = `claim-${randomUUID()}`;
    try {
      const first = await claimIdempotencyKey(tenantId, key, RESOURCE_TYPE, 'payload-hash-C');
      expect(first.status).toBe('CLAIMED');

      // In-flight: hash mismatch must beat the IN_FLIGHT answer, so a mutated
      // retry is never mistaken for a duplicate of the original request.
      const whileInFlight = await claimIdempotencyKey(tenantId, key, RESOURCE_TYPE, 'payload-hash-DIFFERENT');
      expect(whileInFlight).toEqual({ status: 'CONFLICT', existingHash: 'payload-hash-C' });

      // After completion: hash mismatch must also beat the COMPLETED answer,
      // so a mutated retry never replays an unrelated prior result.
      await storeIdempotencyHash(tenantId, key, RESOURCE_TYPE, 'payload-hash-C', randomUUID());
      const afterCompletion = await claimIdempotencyKey(tenantId, key, RESOURCE_TYPE, 'payload-hash-DIFFERENT');
      expect(afterCompletion).toEqual({ status: 'CONFLICT', existingHash: 'payload-hash-C' });
    } finally {
      await deleteIdempotencyHash(tenantId, key, RESOURCE_TYPE);
    }
  });

  dbit('claims are scoped per tenant + resource_type, so unrelated callers never collide', async () => {
    const key = `claim-${randomUUID()}`;
    const otherResourceType = `${RESOURCE_TYPE}_other`;
    try {
      const first = await claimIdempotencyKey(tenantId, key, RESOURCE_TYPE, 'h');
      const sameKeyOtherResource = await claimIdempotencyKey(tenantId, key, otherResourceType, 'h');

      expect(first.status).toBe('CLAIMED');
      // Same key string, different resource namespace — must be independent.
      expect(sameKeyOtherResource.status).toBe('CLAIMED');
    } finally {
      await deleteIdempotencyHash(tenantId, key, RESOURCE_TYPE);
      await deleteIdempotencyHash(tenantId, key, otherResourceType);
    }
  });
});
