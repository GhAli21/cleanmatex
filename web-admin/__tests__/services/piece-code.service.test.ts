/**
 * HFC P3: piece tag checks (lib/services/piece-code/piece-code.service.ts), rules A-35..A-38.
 */
import {
  PIECE_TAG_ERROR_CODES,
  PieceCodeService,
  checkPieceTagFormat,
  isSamePiece,
  isSameTarget,
  isTagReleasingStatus,
  mapPieceTagDbError,
  resetCodePrefixCache,
  type PieceTagHolder,
} from '@/lib/services/piece-code/piece-code.service';

const holder: PieceTagHolder = {
  id: 'p1', order_id: 'o1', order_item_id: 'i1', piece_seq: 2, piece_code: 'ORD-1-1-2', barcode: 'TAG-1',
};

type Rows = Record<string, { data: unknown; error: unknown }>;

/** Supabase stub: every chain is awaitable and returns the rows of its table; calls are recorded. */
function stub(rows: Rows) {
  const calls: Array<[string, ...unknown[]]> = [];
  const supabase = {
    from(table: string) {
      calls.push(['from', table]);
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'is']) {
        b[m] = (...args: unknown[]) => { calls.push([m, ...args]); return b; };
      }
      b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(rows[table] ?? { data: [], error: null }).then(ok, ko);
      return b;
    },
  };
  return { supabase: supabase as never, calls };
}

beforeEach(() => resetCodePrefixCache());

describe('piece-code.service', () => {
  it('checks, trims and upper-cases the tag', () => {
    expect(checkPieceTagFormat(' tag-1 ')).toEqual({ ok: true, tag: 'TAG-1' });
    expect(checkPieceTagFormat('A\nB')).toMatchObject({ ok: false, code: PIECE_TAG_ERROR_CODES.INVALID, tag: 'A\nB', reason: 'PIECE_TAG_BAD_CHARACTERS' });
    expect(checkPieceTagFormat('ord-20261101-0001')).toMatchObject({ ok: false, code: PIECE_TAG_ERROR_CODES.LOOKS_LIKE_CODE });
    expect(checkPieceTagFormat('CMX1:PEC:X')).toMatchObject({ ok: false, code: PIECE_TAG_ERROR_CODES.LOOKS_LIKE_CODE });
    expect(checkPieceTagFormat('CUST-0001', ['CUST'])).toMatchObject({ ok: false, code: PIECE_TAG_ERROR_CODES.LOOKS_LIKE_CODE });
  });

  it('treats the target piece itself as no conflict (by id or by line + number)', () => {
    expect(isSamePiece(holder, { pieceId: 'p1', orderId: 'o1' })).toBe(true);
    expect(isSamePiece(holder, { pieceId: 'i1-2', orderId: 'o1', itemId: 'i1', pieceNumber: 2 })).toBe(true);
    expect(isSamePiece(holder, { pieceId: 'p9', orderId: 'o1', itemId: 'i1', pieceNumber: 3 })).toBe(false);
    expect(isSamePiece(holder, { pieceId: 'p9', orderId: 'o2', itemId: 'i1', pieceNumber: 2 })).toBe(false);
    expect(isSameTarget({ pieceId: 'a', orderId: 'o' }, { pieceId: 'a', orderId: 'o' })).toBe(true);
    expect(isSameTarget({ pieceId: 'a', orderId: 'o', itemId: 'i', pieceNumber: 1 }, { pieceId: 'b', orderId: 'o', itemId: 'i', pieceNumber: 1 })).toBe(true);
    expect(isSameTarget({ pieceId: 'a', orderId: 'o', itemId: 'i', pieceNumber: 1 }, { pieceId: 'b', orderId: 'o', itemId: 'i', pieceNumber: 2 })).toBe(false);
  });

  it('knows which order statuses free tags (A-35)', () => {
    for (const s of ['delivered', 'CLOSED', ' cancelled ']) expect(isTagReleasingStatus(s)).toBe(true);
    for (const s of ['ready', 'processing', '', null, undefined]) expect(isTagReleasingStatus(s)).toBe(false);
  });

  it('maps DB constraint and trigger errors', () => {
    expect(mapPieceTagDbError('duplicate key value violates unique constraint "uq_ord_piece_barcode"')).toBe('PIECE_TAG_IN_USE');
    expect(mapPieceTagDbError('new row violates check constraint "ck_ord_piece_barcode_fmt"')).toBe('PIECE_TAG_INVALID');
    expect(mapPieceTagDbError('new row violates check constraint "ck_ord_piece_barcode_not_code"')).toBe('PIECE_TAG_LOOKS_LIKE_CODE');
    expect(mapPieceTagDbError('PIECE_TAG_LOOKS_LIKE_CODE: tag CUST-1 looks like a CUST code')).toBe('PIECE_TAG_LOOKS_LIKE_CODE');
    expect(mapPieceTagDbError('other')).toBeNull();
    expect(mapPieceTagDbError(undefined)).toBeNull();
  });

  it('looks up live holders: tenant-scoped, removed pieces and delivered/closed/cancelled orders excluded', async () => {
    const other = { ...holder, id: 'p2', order_id: 'o2', barcode: 'TAG-2' };
    const third = { ...holder, id: 'p3', order_id: 'o3', barcode: 'TAG-3' };
    const { supabase, calls } = stub({
      org_order_item_pieces_dtl: { data: [holder, other, third], error: null },
      org_orders_mst: {
        data: [
          { id: 'o1', status: 'processing', current_status: 'processing' },
          { id: 'o2', status: 'Delivered', current_status: null },
          { id: 'o3', status: 'ready', current_status: 'CANCELLED' },
        ],
        error: null,
      },
    });
    const out = await PieceCodeService.findLiveTagHolders(supabase, 't1', ['TAG-1', 'TAG-1', 'TAG-2', 'TAG-3', '']);
    expect(out).toEqual([holder]);
    expect(calls).toEqual(expect.arrayContaining([
      ['from', 'org_order_item_pieces_dtl'],
      ['eq', 'tenant_org_id', 't1'],
      ['in', 'barcode', ['TAG-1', 'TAG-2', 'TAG-3']],
      ['is', 'deleted_order_change_id', null],
      ['from', 'org_orders_mst'],
      ['in', 'id', ['o1', 'o2', 'o3']],
    ]));
    expect(calls.filter((c) => c[0] === 'eq' && c[1] === 'tenant_org_id')).toHaveLength(2);
  });

  it('does not query when there is no tag', async () => {
    const supabase = { from: jest.fn() };
    await expect(PieceCodeService.findLiveTagHolders(supabase as never, 't1', [])).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('loads doc type prefixes once, with the static ones as fallback', async () => {
    const { supabase, calls } = stub({ sys_doc_seq_type_cd: { data: [{ prefix: 'CN', type_prefix: 'SCN' }, { prefix: null, type_prefix: 'CUST' }], error: null } });
    const a = await PieceCodeService.loadCodePrefixes(supabase);
    expect(a).toEqual(expect.arrayContaining(['ORD', 'ITM', 'PEC', 'CN', 'SCN', 'CUST']));
    await PieceCodeService.loadCodePrefixes(supabase);
    expect(calls.filter((c) => c[0] === 'from')).toHaveLength(1);
    resetCodePrefixCache();
    const failing = stub({ sys_doc_seq_type_cd: { data: null, error: { message: 'denied' } } });
    expect(await PieceCodeService.loadCodePrefixes(failing.supabase)).toEqual(['ORD', 'ITM', 'PEC']);
  });

  it('A-38: reports every problem of a batch', async () => {
    const { supabase } = stub({
      sys_doc_seq_type_cd: { data: [{ prefix: null, type_prefix: 'CUST' }], error: null },
      org_order_item_pieces_dtl: { data: [{ ...holder, id: 'px', order_id: 'o9', barcode: 'HELD' }], error: null },
      org_orders_mst: { data: [{ id: 'o9', status: 'ready' }], error: null },
    });
    const t = (pieceId: string, pieceNumber: number) => ({ pieceId, orderId: 'o1', itemId: 'i1', pieceNumber });
    const r = await PieceCodeService.validateBatchTags(supabase, 't1', [
      { index: 0, raw: ' ok-1 ', target: t('a', 1) },
      { index: 1, raw: 'A B', target: t('b', 2) },
      { index: 2, raw: 'cust-77', target: t('c', 3) },
      { index: 3, raw: 'dup', target: t('d', 4) },
      { index: 4, raw: 'DUP', target: t('e', 5) },
      { index: 5, raw: 'held', target: t('f', 6) },
      { index: 6, raw: 'ok-1', target: t('a', 1) }, // same piece twice: fine
    ]);
    expect(r.issues.map((i) => [i.index, i.code])).toEqual([
      [1, 'PIECE_TAG_INVALID'],
      [2, 'PIECE_TAG_LOOKS_LIKE_CODE'],
      [4, 'PIECE_TAG_DUPLICATE_IN_BATCH'],
      [5, 'PIECE_TAG_IN_USE'],
    ]);
    expect(r.issues[3]).toMatchObject({ tag: 'HELD', heldByPieceCode: 'ORD-1-1-2' });
    expect([...r.tags.entries()]).toEqual([[0, 'OK-1'], [3, 'DUP'], [6, 'OK-1']]);
  });
});
