import { committedCommercialEchoChanged, legacyCommittedReplacementDecision, payloadIncludesCommittedCommercialChange } from '@/lib/services/order-change/order-change-legacy-writer-guard';

describe('legacyCommittedReplacementDecision', () => {
  it('retires the full replacement when Edit Order V2 is on and the order is committed', () => {
    expect(legacyCommittedReplacementDecision({
      committedAt: '2026-10-15T00:00:00.000Z',
      editStateVersion: 1,
      featureEnabled: true,
    })).toBe('RETIRED');
  });

  it('still allows an uncommitted order and a disabled flag', () => {
    expect(legacyCommittedReplacementDecision({
      committedAt: null,
      editStateVersion: 0,
      featureEnabled: true,
    })).toBe('ALLOW');
    expect(legacyCommittedReplacementDecision({
      committedAt: '2026-10-15T00:00:00.000Z',
      editStateVersion: 3,
      featureEnabled: false,
    })).toBe('ALLOW');
  });

  it('treats piece color and notes as commercial and leaves readiness alone', () => {
    expect(payloadIncludesCommittedCommercialChange({ color: 'BLUE' })).toBe(true);
    expect(payloadIncludesCommittedCommercialChange({
      updates: [{ updates: { notes: 'torn' } }],
    })).toBe(true);
    expect(payloadIncludesCommittedCommercialChange({
      is_ready: true,
      rack_location: 'A1',
      piece_status: 'ready',
    })).toBe(false);
  });

  it('treats an echoed processing note as unchanged and a new note as a commercial edit', () => {
    expect(committedCommercialEchoChanged(
      { notes: 'torn', has_stain: false, has_damage: null },
      { notes: 'torn', has_stain: null, has_damage: false },
    )).toBe(false);
    expect(committedCommercialEchoChanged(
      { notes: 'torn', has_stain: false, has_damage: false },
      { notes: 'rewritten' },
    )).toBe(true);
  });
});
