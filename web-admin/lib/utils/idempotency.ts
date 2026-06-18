/**
 * Idempotency helpers for write-path API routes.
 *
 * Why:
 * The contract for write endpoints (POST /api/v1/orders/submit-order) promises:
 *   - same key + same payload → return cached result (200)
 *   - same key + different payload → 409 IDEMPOTENCY_CONFLICT
 *
 * The contract was previously only enforced on key match — payload was never
 * compared, so a retry with a mutated body silently returned stale data.
 *
 * This utility provides:
 *   - canonicalize() — deterministic JSON serialization (sorted keys, normalized)
 *   - hashPayload() — SHA-256 digest of canonical JSON
 *   - storeIdempotencyHashTx() — write hash record to org_idempotency_keys
 *   - findIdempotencyHash() — read hash record for conflict detection
 */

import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';

/**
 * Canonicalize a value for hashing.
 * - Object keys are sorted recursively so { a, b } and { b, a } produce the same string
 * - Arrays preserve order (semantic)
 * - undefined values are dropped (matches JSON.stringify default)
 * - Dates → ISO string
 * - Strings, numbers, booleans pass through
 * @param value
 */
export function canonicalize(value: unknown): string {
  const canon = canonicalizeValue(value);
  // Top-level undefined → 'null' (matches JSON contract; ensures every input
  // produces a hashable string, never the literal `undefined`).
  return JSON.stringify(canon === undefined ? null : canon);
}

function canonicalizeValue(value: unknown): unknown {
  if (value === undefined) return undefined; // dropped from objects, becomes null at top level via JSON.stringify
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => canonicalizeValue(v) ?? null); // arrays preserve length
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      // Drop keys whose original value was undefined — matches JSON.stringify
      // and ensures { a:1, b:undefined } and { a:1 } produce the same hash.
      if (obj[key] === undefined) continue;
      const v = canonicalizeValue(obj[key]);
      if (v !== undefined) sorted[key] = v;
    }
    return sorted;
  }
  return value;
}

/**
 * SHA-256 hex digest of the canonicalized payload. Stable across retries.
 * @param payload
 */
export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex');
}

const DEFAULT_TTL_DAYS = 7;

/**
 * Find an existing idempotency record by tenant + key + resource_type.
 * Returns `{ hash, resourceId }` if found, `null` if not.
 *
 * The hash lives in response_cache.payload_hash (JSON field) — no schema change
 * needed because org_idempotency_keys already exposes response_cache: Json?.
 * @param tenantId
 * @param key
 * @param resourceType
 */
export async function findIdempotencyHash(
  tenantId: string,
  key: string,
  resourceType: string
): Promise<{ hash: string | null; resourceId: string | null } | null> {
  const row = await prisma.org_idempotency_keys.findFirst({
    where: {
      tenant_org_id: tenantId,
      key,
      resource_type: resourceType,
    },
    select: { response_cache: true, resource_id: true },
  });
  if (!row) return null;
  const cache = row.response_cache as { payload_hash?: string } | null;
  return {
    hash: cache?.payload_hash ?? null,
    resourceId: row.resource_id ?? null,
  };
}

/**
 * Store an idempotency record carrying the payload hash + optional resource id.
 * Uses upsert so retries from the same caller don't insert duplicate rows.
 *
 * @param ttlDays - Time-to-live in days (default 7). After expiry the row is
 *                  eligible for cleanup but the unique constraint stays active.
 */
/**
 * Delete the idempotency record for (tenant, key, resourceType).
 *
 * Used by submit-order route to "unstake" a placeholder when the orchestrator
 * fails BEFORE any DB write (validation / pre-flight errors). The placeholder
 * exists only to block retries that could produce orphan state — a pure
 * validation failure means there is no orphan state and the same key should
 * be reusable.
 *
 * Idempotent: missing row is treated as success.
 * @param tenantId
 * @param key
 * @param resourceType
 */
export async function deleteIdempotencyHash(
  tenantId: string,
  key: string,
  resourceType: string
): Promise<void> {
  await prisma.org_idempotency_keys.deleteMany({
    where: { tenant_org_id: tenantId, key, resource_type: resourceType },
  });
}

/**
 *
 * @param tenantId
 * @param key
 * @param resourceType
 * @param payloadHash
 * @param resourceId
 * @param ttlDays
 */
export async function storeIdempotencyHash(
  tenantId: string,
  key: string,
  resourceType: string,
  payloadHash: string,
  resourceId: string | null,
  ttlDays: number = DEFAULT_TTL_DAYS
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  await prisma.org_idempotency_keys.upsert({
    where: {
      tenant_org_id_key_resource_type: {
        tenant_org_id: tenantId,
        key,
        resource_type: resourceType,
      },
    },
    create: {
      tenant_org_id:  tenantId,
      key,
      resource_type:  resourceType,
      resource_id:    resourceId,
      response_cache: { payload_hash: payloadHash },
      created_at:     now,
      expires_at:     expiresAt,
    },
    update: {
      // Refresh resource_id on success but keep the original hash so a later
      // mutated retry can still detect the mismatch.
      ...(resourceId != null && { resource_id: resourceId }),
    },
  });
}

/**
 * Atomically stake an idempotency key and verify the persisted payload hash.
 *
 * Why:
 * Two concurrent requests can both miss the pre-read. The upsert preserves the
 * first payload hash, then this post-write read detects whether the caller lost
 * the race to a different payload before any side effects run.
 *
 * @param tenantId active tenant scope
 * @param key idempotency key from the request
 * @param resourceType endpoint-specific resource namespace
 * @param payloadHash canonical request payload hash
 * @returns conflict=false when the key belongs to this payload; conflict=true when a different payload already owns it
 */
export async function stakeIdempotencyHash(
  tenantId: string,
  key: string,
  resourceType: string,
  payloadHash: string,
): Promise<{ conflict: false; resourceId: string | null } | { conflict: true; existingHash: string | null }> {
  await storeIdempotencyHash(tenantId, key, resourceType, payloadHash, null);
  const staked = await findIdempotencyHash(tenantId, key, resourceType);
  if (!staked) {
    throw new Error('IDEMPOTENCY_CLAIM_NOT_FOUND_AFTER_STAKE');
  }
  if (staked.hash && staked.hash !== payloadHash) {
    return { conflict: true, existingHash: staked.hash };
  }
  return { conflict: false, resourceId: staked.resourceId };
}
