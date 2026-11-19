/**
 * PR-04 review #1: the submit gate and the disabled button share one ready-by rule,
 * so F9 / Ctrl+Enter cannot open payment with a missing or past ready-by.
 */
import { readyByBlockReason } from '@/lib/utils/ready-by-calculator';

const now = new Date('2026-11-19T10:00:00Z');

describe('readyByBlockReason', () => {
  it('missing ready-by is required', () => {
    expect(readyByBlockReason('', false, now)).toBe('readyByRequired');
    expect(readyByBlockReason(null, false, now)).toBe('readyByRequired');
  });
  it('past ready-by must be in the future', () => {
    expect(readyByBlockReason('2026-11-19T09:59:00Z', false, now)).toBe('readyByMustBeFuture');
    expect(readyByBlockReason('2026-11-19T10:00:00Z', false, now)).toBe('readyByMustBeFuture');
  });
  it('future ready-by passes', () => {
    expect(readyByBlockReason('2026-11-19T10:01:00Z', false, now)).toBeNull();
  });
  it('retail allows up to one minute in the past', () => {
    expect(readyByBlockReason('2026-11-19T09:59:30Z', true, now)).toBeNull();
    expect(readyByBlockReason('2026-11-19T09:58:00Z', true, now)).toBe('readyByMustBeFuture');
  });
});
