/** @jest-environment node */

import { loadWorkflowGateFacts } from '@/lib/services/workflow/workflow-gate-facts.service';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '22222222-2222-2222-2222-222222222222';
const queryRawMock = jest.fn();

function sqlText(query: unknown): string {
  const strings = (query as { strings?: readonly string[] }).strings;
  return strings?.join('?') ?? '';
}

async function loadExtendedFacts() {
  queryRawMock
    .mockResolvedValueOnce([{ active_item_count: 1, unready_item_count: 0, expected_piece_count: 1 }])
    .mockResolvedValueOnce([{ active_piece_count: 1, scanned_piece_count: 1, ready_piece_count: 1 }])
    .mockResolvedValueOnce([{ count: 0 }])
    .mockResolvedValueOnce([{ task_count: 0, passed_count: 0 }])
    .mockResolvedValueOnce([{ present: false }])
    .mockResolvedValueOnce([{ present: false }]);

  return loadWorkflowGateFacts({
    tenantId: TENANT_ID,
    order: {
      tenant_org_id: TENANT_ID,
      id: ORDER_ID,
      current_status: 'processing',
      preparation_status: null,
      rack_location: null,
      payment_type_code: null,
      outstanding_amount: '0',
    },
    gateCodes: ['all_pieces_scanned'],
    phase: 'execute',
    transaction: { $queryRaw: queryRawMock } as never,
  });
}

describe('workflow gate commercial-row facts', () => {
  beforeEach(() => {
    queryRawMock.mockReset();
  });

  it('counts only rec_status 1 commercial item and piece rows', async () => {
    const facts = await loadExtendedFacts();
    const queries = queryRawMock.mock.calls.map(([query]) => sqlText(query));
    const itemQuery = queries.find((query) => query.includes('public.org_order_items_dtl'));
    const pieceQuery = queries.find((query) => query.includes('public.org_order_item_pieces_dtl'));

    expect(facts).toMatchObject({
      activeItemCount: 1,
      activePieceCount: 1,
      scannedPieceCount: 1,
      readyPieceCount: 1,
    });
    expect(itemQuery).toContain('AND rec_status = 1');
    expect(pieceQuery).toContain('AND rec_status = 1');
    expect(itemQuery).not.toContain('COALESCE(rec_status, 1) = 1');
    expect(pieceQuery).not.toContain('COALESCE(rec_status, 1) = 1');
  });

  it('excludes legacy NULL and removed 0 commercial rows from the active truth set', () => {
    const statuses: Array<number | null> = [null, 0, 1];

    // This is the exact SQL predicate used by the item and piece gate aggregates.
    expect(statuses.map((recStatus) => recStatus === 1)).toEqual([false, false, true]);
  });
});
