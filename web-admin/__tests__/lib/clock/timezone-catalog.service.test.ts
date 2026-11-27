/**
 * @jest-environment node
 */
/** G2 (S4): the server zone check uses the catalog rule of the database validators. */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/prisma', () => ({ prisma: { $queryRaw: jest.fn(), sys_timezone_cd: { findMany: jest.fn() } } }));

import { canonicalActiveZoneOn } from '@/lib/services/timezone-catalog.service';

const db = (zone: string | null) =>
  ({ $queryRaw: jest.fn(async () => [{ zone }]) }) as unknown as Parameters<typeof canonicalActiveZoneOn>[0];

describe('canonicalActiveZoneOn', () => {
  it('returns the canonical active name the database gives', async () => {
    const d = db('Asia/Kolkata');
    await expect(canonicalActiveZoneOn(d, ' Asia/Calcutta ')).resolves.toBe('Asia/Kolkata');
    expect((d.$queryRaw as jest.Mock).mock.calls[0][0].values).toEqual(['Asia/Calcutta']);
  });

  it('refuses unknown, empty and oversized names without guessing', async () => {
    await expect(canonicalActiveZoneOn(db(null), 'GMT+4')).resolves.toBeNull();
    const d = db('UTC');
    await expect(canonicalActiveZoneOn(d, '')).resolves.toBeNull();
    await expect(canonicalActiveZoneOn(d, 'x'.repeat(65))).resolves.toBeNull();
    expect(d.$queryRaw).not.toHaveBeenCalled();
  });
});
