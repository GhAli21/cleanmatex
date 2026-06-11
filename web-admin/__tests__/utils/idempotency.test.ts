/**
 * Tests: lib/utils/idempotency.ts
 *
 * Why these tests exist:
 * S2 conflict detection (same key + different payload → 409) hinges on
 * deterministic canonicalization and a stable SHA-256 hash. A regression
 * that reorders object keys or treats undefined inconsistently would either
 * fire false 409s or silently swallow real mismatches. These tests pin the
 * behavior.
 */

const mockFindFirst = jest.fn();
const mockUpsert = jest.fn();

// idempotency.ts imports prisma at the module level; mock it so this test file
// does not pull the Prisma client into jsdom env.
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_idempotency_keys: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

import { canonicalize, hashPayload, stakeIdempotencyHash, storeIdempotencyHash } from '@/lib/utils/idempotency';

describe('canonicalize', () => {
  it('produces the same string regardless of object key order', () => {
    const a = canonicalize({ a: 1, b: 2, c: 3 });
    const b = canonicalize({ c: 3, b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it('handles nested objects', () => {
    const a = canonicalize({ outer: { z: 1, a: 2 }, x: 10 });
    const b = canonicalize({ x: 10, outer: { a: 2, z: 1 } });
    expect(a).toBe(b);
  });

  it('preserves array order (semantic)', () => {
    const a = canonicalize({ items: [1, 2, 3] });
    const b = canonicalize({ items: [3, 2, 1] });
    expect(a).not.toBe(b);
  });

  it('drops undefined values', () => {
    const result = canonicalize({ a: 1, b: undefined, c: 3 });
    expect(JSON.parse(result)).toEqual({ a: 1, c: 3 });
  });

  it('normalizes null and undefined to null at top level', () => {
    expect(canonicalize(null)).toBe('null');
    expect(canonicalize(undefined)).toBe('null');
  });

  it('serializes Date as ISO string', () => {
    const d = new Date('2026-05-28T12:00:00.000Z');
    expect(canonicalize({ when: d })).toBe('{"when":"2026-05-28T12:00:00.000Z"}');
  });

  it('preserves strings, numbers, and booleans', () => {
    expect(canonicalize({ s: 'x', n: 1, b: true })).toBe('{"b":true,"n":1,"s":"x"}');
  });
});

describe('hashPayload', () => {
  it('produces a 64-character hex SHA-256', () => {
    const h = hashPayload({ a: 1 });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable across key-order permutations', () => {
    const h1 = hashPayload({ a: 1, b: { x: 2, y: 3 } });
    const h2 = hashPayload({ b: { y: 3, x: 2 }, a: 1 });
    expect(h1).toBe(h2);
  });

  it('changes when a value changes', () => {
    const h1 = hashPayload({ amount: 100 });
    const h2 = hashPayload({ amount: 101 });
    expect(h1).not.toBe(h2);
  });

  it('changes when a key is added', () => {
    const h1 = hashPayload({ a: 1 });
    const h2 = hashPayload({ a: 1, b: 2 });
    expect(h1).not.toBe(h2);
  });
});

describe('stakeIdempotencyHash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects when a concurrent request already staked a different payload hash', async () => {
    mockUpsert.mockResolvedValue({});
    mockFindFirst.mockResolvedValue({
      response_cache: { payload_hash: 'hash-from-other-payload' },
      resource_id: null,
    });

    const result = await stakeIdempotencyHash('tenant-1', 'key-1', 'submit_order', 'current-hash');

    expect(result).toEqual({ conflict: true, existingHash: 'hash-from-other-payload' });
  });

  it('does not clear resource_id when staking a placeholder over a committed row', async () => {
    mockUpsert.mockResolvedValue({});

    await storeIdempotencyHash('tenant-1', 'key-1', 'submit_order', 'hash-1', null);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {},
      }),
    );
  });
});
