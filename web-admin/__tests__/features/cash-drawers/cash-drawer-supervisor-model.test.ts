import { buildDispositionPayload, type DispositionFormRow } from '@features/cash-drawers/model/cash-drawer-disposition';
import { findRecountTarget } from '@features/cash-drawers/model/cash-drawer-recount';
import type { SessionClosureCountView } from '@features/cash-drawers/api/cash-drawer-api';

const CATALOG = [
  { code: 'LEFT_IN_DRAWER', name: 'Left', name2: null, cashMoveMode: 'NONE', destDrawerTypeCode: null, requiresNotes: false, requiresKeptAmount: false, isSelectable: true, displayOrder: 1 },
  { code: 'MOVED_TO_SAFE', name: 'Safe', name2: null, cashMoveMode: 'ALL', destDrawerTypeCode: 'SAFE', requiresNotes: false, requiresKeptAmount: false, isSelectable: true, displayOrder: 2 },
  { code: 'PARTIAL_REMOVED', name: 'Partial', name2: null, cashMoveMode: 'PART', destDrawerTypeCode: 'SAFE', requiresNotes: false, requiresKeptAmount: true, isSelectable: true, displayOrder: 3 },
  { code: 'OTHER', name: 'Other', name2: null, cashMoveMode: 'NONE', destDrawerTypeCode: null, requiresNotes: true, requiresKeptAmount: false, isSelectable: true, displayOrder: 4 },
] as const;

const row = (over: Partial<DispositionFormRow> = {}): DispositionFormRow => ({
  dispositionCode: 'LEFT_IN_DRAWER',
  destDrawerId: '',
  keptAmount: '',
  dispositionNotes: '',
  ...over,
});

describe('buildDispositionPayload', () => {
  it('builds one decision per currency for a valid form', () => {
    const result = buildDispositionPayload(['OMR'], { OMR: row() }, CATALOG);
    expect(result.error).toBeNull();
    expect(result.payload).toEqual([
      { currencyCode: 'OMR', dispositionCode: 'LEFT_IN_DRAWER', dispositionNotes: undefined, destDrawerId: undefined, keptAmount: undefined },
    ]);
  });

  it('requires a disposition for every currency', () => {
    expect(buildDispositionPayload(['OMR', 'USD'], { OMR: row() }, CATALOG).error).toBe('dispositionRequired');
    expect(buildDispositionPayload(['OMR'], {}, CATALOG).error).toBe('dispositionRequired');
  });

  it('requires a destination for a cash-moving disposition', () => {
    expect(buildDispositionPayload(['OMR'], { OMR: row({ dispositionCode: 'MOVED_TO_SAFE' }) }, CATALOG).error).toBe('destinationRequired');
    const ok = buildDispositionPayload(['OMR'], { OMR: row({ dispositionCode: 'MOVED_TO_SAFE', destDrawerId: 'd-safe' }) }, CATALOG);
    expect(ok.error).toBeNull();
    expect(ok.payload[0].destDrawerId).toBe('d-safe');
  });

  it('never invents a kept amount: a blank or negative figure is refused, a typed one is sent as typed', () => {
    const partial = (keptAmount: string) =>
      buildDispositionPayload(['OMR'], { OMR: row({ dispositionCode: 'PARTIAL_REMOVED', destDrawerId: 'd', keptAmount }) }, CATALOG);
    expect(partial('').error).toBe('keptAmountRequired');
    expect(partial('-1').error).toBe('keptAmountRequired');
    expect(partial('abc').error).toBe('keptAmountRequired');
    expect(partial('12.5').payload[0].keptAmount).toBe(12.5);
    expect(partial('0').payload[0].keptAmount).toBe(0);
  });

  it('requires notes when the disposition says so and trims them', () => {
    expect(buildDispositionPayload(['OMR'], { OMR: row({ dispositionCode: 'OTHER', dispositionNotes: '  ' }) }, CATALOG).error).toBe('dispositionNotesRequired');
    expect(buildDispositionPayload(['OMR'], { OMR: row({ dispositionCode: 'OTHER', dispositionNotes: ' handed to boss ' }) }, CATALOG).payload[0].dispositionNotes).toBe('handed to boss');
  });
});

describe('findRecountTarget', () => {
  const count = (over: Partial<SessionClosureCountView>): SessionClosureCountView => ({
    countId: 'c1',
    countType: 'CLOSING',
    countMethod: 'TOTAL_ONLY',
    currencyCode: 'OMR',
    expectedAmount: '10.0000',
    countedAmount: '9.0000',
    varianceAmount: '-1.0000',
    countedBy: 'u',
    countedAt: '2026-10-03T10:00:00Z',
    notes: null,
    supersedesCountId: null,
    denominations: [],
    ...over,
  });

  it('is the closing count when there is no recount yet', () => {
    expect(findRecountTarget([count({})], 'OMR')?.countId).toBe('c1');
  });

  it('is the head of the chain once recounts exist (a superseded count is never the target)', () => {
    const counts = [
      count({ countId: 'c1' }),
      count({ countId: 'c2', countType: 'RECOUNT', supersedesCountId: 'c1' }),
      count({ countId: 'c3', countType: 'RECOUNT', supersedesCountId: 'c2' }),
    ];
    expect(findRecountTarget(counts, 'OMR')?.countId).toBe('c3');
  });

  it('ignores opening and spot counts and other currencies; null when nothing to replace', () => {
    const counts = [count({ countId: 'o1', countType: 'OPENING' }), count({ countId: 's1', countType: 'SPOT' }), count({ countId: 'u1', currencyCode: 'USD' })];
    expect(findRecountTarget(counts, 'OMR')).toBeNull();
    expect(findRecountTarget(counts, 'USD')?.countId).toBe('u1');
  });
});
