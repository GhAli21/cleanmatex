/** @jest-environment node */

const m = {
  categoryFindFirst: jest.fn(),
  purposeFindFirst: jest.fn(),
  linkFindFirst: jest.fn(),
  bucketFind: jest.fn(),
  orderFindFirst: jest.fn(),
  pieceFindFirst: jest.fn(),
  fileCount: jest.fn(),
  fileCreate: jest.fn(),
  fileFindFirst: jest.fn(),
  fileFindMany: jest.fn(),
  fileUpdateMany: jest.fn(),
  executeRaw: jest.fn(),
  canStoreBytes: jest.fn(),
  download: jest.fn(),
  remove: jest.fn(),
  signedUpload: jest.fn(),
  signedUrls: jest.fn(),
  productUpdateMany: jest.fn(),
  tenantUpdateMany: jest.fn(),
  queryRaw: jest.fn(),
  enqueue: jest.fn(),
};

const mockFileModel = {
  count: (...a: unknown[]) => m.fileCount(...a),
  create: (...a: unknown[]) => m.fileCreate(...a),
  findFirst: (...a: unknown[]) => m.fileFindFirst(...a),
  findMany: (...a: unknown[]) => m.fileFindMany(...a),
  updateMany: (...a: unknown[]) => m.fileUpdateMany(...a),
};
const mockTx = {
  org_file_mst: mockFileModel,
  org_product_data_mst: { updateMany: (...a: unknown[]) => m.productUpdateMany(...a) },
  org_tenants_mst: { updateMany: (...a: unknown[]) => m.tenantUpdateMany(...a) },
  $executeRaw: (...a: unknown[]) => m.executeRaw(...a),
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    sys_file_category_cd: { findFirst: (...a: unknown[]) => m.categoryFindFirst(...a) },
    sys_file_purpose_cd: { findFirst: (...a: unknown[]) => m.purposeFindFirst(...a) },
    sys_file_purpose_mime_dtl: { findFirst: (...a: unknown[]) => m.linkFindFirst(...a) },
    sys_file_bucket_cd: { findUniqueOrThrow: (...a: unknown[]) => m.bucketFind(...a) },
    org_orders_mst: { findFirst: (...a: unknown[]) => m.orderFindFirst(...a) },
    org_order_item_pieces_dtl: { findFirst: (...a: unknown[]) => m.pieceFindFirst(...a) },
    get org_file_mst() { return mockFileModel; },
    $transaction: (fn: (t: typeof mockTx) => unknown) => fn(mockTx),
    $queryRaw: (...a: unknown[]) => m.queryRaw(...a),
  },
}));
jest.mock('@/lib/jobs/producer', () => ({ jobs: { enqueue: (...a: unknown[]) => m.enqueue(...a) } }));
jest.mock('@/lib/db/tenant-guard', () => ({ withTenantGuardBypass: (_r: string, fn: () => unknown) => fn() }));
jest.mock('@/lib/services/usage-tracking.service', () => ({ canStoreBytes: (...a: unknown[]) => m.canStoreBytes(...a) }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: () => ({
    storage: {
      from: () => ({
        download: m.download,
        remove: m.remove,
        createSignedUploadUrl: m.signedUpload,
        createSignedUrls: m.signedUrls,
        getPublicUrl: (k: string) => ({ data: { publicUrl: `https://pub/${k}` } }),
      }),
    },
  }),
}));

import {
  completeFileUpload,
  deleteFile,
  FILE_PURGE_BATCH,
  FileUtilError,
  initFileUpload,
  purgeDeletedFiles,
  updateFile,
} from '@/lib/services/file-util/file-util.service';

const T1 = '11111111-1111-1111-1111-111111111111';
const T2 = '99999999-9999-9999-9999-999999999999';
const ORDER = '22222222-2222-2222-2222-222222222222';
const FILE = '33333333-3333-3333-3333-333333333333';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

const BASE = {
  tenantId: T1,
  userId: 'user-1',
  categoryCode: 'ORDER_FILE' as const,
  entityId: ORDER,
  sourceCode: 'ORDER_DETAIL' as const,
  fileName: 'stain.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: JPEG.length,
};

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(FileUtilError);
  await expect(p).rejects.toMatchObject({ code });
}

beforeEach(() => {
  jest.clearAllMocks();
  m.categoryFindFirst.mockResolvedValue({
    max_size_bytes: BigInt(10485760),
    max_files_per_entity: 100,
    sys_file_bucket_cd: { bucket_code: 'TENANT_FILES', storage_bucket_id: 'tenants-cmx-files', is_public: false, scope_code: 'TENANT', is_active: true },
  });
  m.purposeFindFirst.mockResolvedValue({ purpose_code: 'BEFORE_IMAGE', max_files: null, max_size_bytes: null });
  m.linkFindFirst.mockResolvedValue({
    sys_file_mime_types_cd: { extensions: ['jpg', 'jpeg', 'jfif'], max_size_bytes: null, sys_file_media_kind_cd: { max_size_bytes: BigInt(10485760) } },
  });
  m.bucketFind.mockResolvedValue({ storage_bucket_id: 'tenants-cmx-files', is_public: false });
  m.orderFindFirst.mockResolvedValue({ current_status: 'preparation', status: 'preparation' });
  m.fileCount.mockResolvedValue(0);
  m.canStoreBytes.mockResolvedValue({ canProceed: true, current: 0, limit: 100 });
  m.signedUpload.mockImplementation(async (path: string) => ({ data: { path, token: 't', signedUrl: `https://up/${path}` }, error: null }));
  m.signedUrls.mockImplementation(async (keys: string[]) => ({ data: keys.map((path) => ({ path, signedUrl: `https://s/${path}` })), error: null }));
  m.remove.mockResolvedValue({ error: null });
  m.fileUpdateMany.mockResolvedValue({ count: 1 });
});

describe('initFileUpload', () => {
  it('reserves a PENDING row under the tenant folder and checks ownership with the tenant id', async () => {
    const result = await initFileUpload(BASE);

    expect(m.orderFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ORDER, tenant_org_id: T1 } }));
    const data = m.fileCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ tenant_org_id: T1, status_code: 'PENDING', purpose_code: 'BEFORE_IMAGE', mime_type: 'image/jpeg' });
    expect(data.object_key).toMatch(new RegExp(`^${T1}/ORDER_FILE/${ORDER}/[0-9a-f-]+\\.jpg$`));
    expect(result.upload.signedUrl).toContain(data.object_key);
    expect(result.thumbUpload).toBeNull();
    expect(m.executeRaw).toHaveBeenCalled(); // advisory lock taken before counting
  });

  it('records the order stage at upload, read by id and tenant', async () => {
    m.orderFindFirst.mockResolvedValue({ current_status: 'ready_for_pickup', status: 'ready' });
    await initFileUpload({ ...BASE, sourceCode: 'ORDER_READY' });
    expect(m.orderFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ORDER, tenant_org_id: T1 } }));
    expect(m.fileCreate.mock.calls[0][0].data).toMatchObject({ stage_code: 'ready_for_pickup', source_code: 'ORDER_READY' });
  });

  it('falls back to status when current_status is empty', async () => {
    m.orderFindFirst.mockResolvedValue({ current_status: null, status: 'intake' });
    await initFileUpload(BASE);
    expect(m.fileCreate.mock.calls[0][0].data.stage_code).toBe('intake');
  });

  it('refuses another tenant\'s order', async () => {
    m.orderFindFirst.mockResolvedValue(null);
    await expectCode(initFileUpload({ ...BASE, tenantId: T2 }), 'ENTITY_NOT_FOUND');
    expect(m.orderFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ORDER, tenant_org_id: T2 } }));
    expect(m.fileCreate).not.toHaveBeenCalled();
  });

  it('checks a sub-record belongs to the same order and tenant', async () => {
    m.pieceFindFirst.mockResolvedValue(null);
    await expectCode(initFileUpload({ ...BASE, refTypeCode: 'ORDER_PIECE', refId: FILE }), 'REF_NOT_FOUND');
    expect(m.pieceFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: FILE, tenant_org_id: T1, order_id: ORDER } }));
  });

  it('refuses a type the purpose does not accept', async () => {
    m.linkFindFirst.mockResolvedValue(null);
    await expectCode(initFileUpload({ ...BASE, mimeType: 'application/pdf', fileName: 'a.pdf' }), 'TYPE_NOT_ALLOWED');
  });

  it('refuses an extension that does not match the type', async () => {
    await expectCode(initFileUpload({ ...BASE, fileName: 'evil.exe' }), 'EXTENSION_MISMATCH');
  });

  it('refuses a file over the limit', async () => {
    await expectCode(initFileUpload({ ...BASE, sizeBytes: 10485761 }), 'FILE_TOO_LARGE');
  });

  it('uses the smaller of the type/kind limit and the purpose/category limit', async () => {
    // Kind limit 1 MB < category 10 MB → 1 MB wins.
    m.linkFindFirst.mockResolvedValue({
      sys_file_mime_types_cd: { extensions: ['jpg'], max_size_bytes: null, sys_file_media_kind_cd: { max_size_bytes: BigInt(1048576) } },
    });
    await expectCode(initFileUpload({ ...BASE, sizeBytes: 1048577 }), 'FILE_TOO_LARGE');
    // Type override 2 MB beats the kind; purpose 1.5 MB is smaller still.
    m.linkFindFirst.mockResolvedValue({
      sys_file_mime_types_cd: { extensions: ['jpg'], max_size_bytes: BigInt(2097152), sys_file_media_kind_cd: { max_size_bytes: BigInt(1048576) } },
    });
    m.purposeFindFirst.mockResolvedValue({ purpose_code: 'BEFORE_IMAGE', max_files: null, max_size_bytes: BigInt(1572864) });
    await expectCode(initFileUpload({ ...BASE, sizeBytes: 1572865 }), 'FILE_TOO_LARGE');
    await expect(initFileUpload({ ...BASE, sizeBytes: 1572864 })).resolves.toBeDefined();
  });

  it('refuses when the purpose is full', async () => {
    m.purposeFindFirst.mockResolvedValue({ purpose_code: 'ITEM_VIDEO', max_files: 5, max_size_bytes: null });
    m.fileCount.mockResolvedValue(5);
    await expectCode(initFileUpload(BASE), 'LIMIT_REACHED');
    expect(m.fileCreate).not.toHaveBeenCalled();
  });

  it('lets a single-slot purpose replace instead of hitting its limit', async () => {
    m.purposeFindFirst.mockResolvedValue({ purpose_code: 'SIGNATURE', max_files: 1, max_size_bytes: null });
    m.fileCount.mockResolvedValue(1);
    await initFileUpload(BASE);
    expect(m.fileCreate).toHaveBeenCalled();
  });

  it('refuses when the plan storage is full, counting the thumbnail', async () => {
    m.canStoreBytes.mockResolvedValue({ canProceed: false, current: 100, limit: 100, message: 'full' });
    await expectCode(initFileUpload({ ...BASE, thumbSizeBytes: 500 }), 'QUOTA_EXCEEDED');
    expect(m.canStoreBytes).toHaveBeenCalledWith(T1, JPEG.length + 500);
  });

  it('fails closed with a clear code when the organization has no plan', async () => {
    m.canStoreBytes.mockRejectedValue(new Error('Subscription not found'));
    await expectCode(initFileUpload(BASE), 'PLAN_UNAVAILABLE');
  });
});

describe('completeFileUpload', () => {
  const pending = {
    status_code: 'PENDING', bucket_code: 'TENANT_FILES', object_key: `${T1}/ORDER_FILE/${ORDER}/${FILE}.jpg`, thumb_object_key: null,
    mime_type: 'image/jpeg', size_bytes: BigInt(JPEG.length), purpose_code: 'BEFORE_IMAGE', entity_id: ORDER, sys_file_purpose_cd: { max_files: null },
  };
  const viewRow = {
    id: FILE, category_code: 'ORDER_FILE', purpose_code: 'BEFORE_IMAGE', entity_id: ORDER, ref_type_code: null, ref_id: null,
    source_code: 'ORDER_DETAIL', notes: null, original_name: 'stain.jpg', mime_type: 'image/jpeg', size_bytes: BigInt(JPEG.length),
    width: null, height: null, duration_ms: null, sort_order: 0, created_at: new Date('2026-11-17T00:00:00Z'), created_by: 'user-1',
    bucket_code: 'TENANT_FILES', object_key: pending.object_key, thumb_object_key: null,
  };
  const blob = (buf: Buffer) => ({ arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) });

  it('verifies bytes, stores the hash and returns a signed view', async () => {
    m.fileFindFirst.mockResolvedValueOnce(pending).mockResolvedValueOnce(viewRow);
    m.download.mockResolvedValue({ data: blob(JPEG), error: null });

    const view = await completeFileUpload(T1, 'user-1', 'ORDER_FILE', FILE);

    expect(m.fileFindFirst.mock.calls[0][0].where).toEqual({ id: FILE, tenant_org_id: T1, category_code: 'ORDER_FILE' });
    expect(m.fileUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: FILE, tenant_org_id: T1, status_code: 'PENDING' },
      data: { status_code: 'READY', sha256_hex: expect.stringMatching(/^[0-9a-f]{64}$/) },
    });
    expect(view).toMatchObject({ id: FILE, sizeBytes: JPEG.length, url: `https://s/${pending.object_key}` });
  });

  it('is idempotent for a READY file', async () => {
    m.fileFindFirst.mockResolvedValueOnce({ ...pending, status_code: 'READY' }).mockResolvedValueOnce(viewRow);
    await completeFileUpload(T1, 'user-1', 'ORDER_FILE', FILE);
    expect(m.download).not.toHaveBeenCalled();
    expect(m.fileUpdateMany).not.toHaveBeenCalled();
  });

  it('removes and deletes a file whose content is not its declared type', async () => {
    const html = Buffer.from('<html><b>x</b>', 'latin1');
    m.fileFindFirst.mockResolvedValueOnce({ ...pending, size_bytes: BigInt(html.length) });
    m.download.mockResolvedValue({ data: blob(html), error: null });

    await expectCode(completeFileUpload(T1, 'user-1', 'ORDER_FILE', FILE), 'CONTENT_MISMATCH');
    expect(m.remove).toHaveBeenCalledWith([pending.object_key]);
    expect(m.fileUpdateMany.mock.calls[0][0]).toMatchObject({ where: { id: FILE, tenant_org_id: T1 }, data: { status_code: 'DELETED', rec_status: 0, is_active: false } });
  });

  it('rejects a size different from the declared one (quota bypass)', async () => {
    m.fileFindFirst.mockResolvedValueOnce({ ...pending, size_bytes: BigInt(2) });
    m.download.mockResolvedValue({ data: blob(JPEG), error: null });
    await expectCode(completeFileUpload(T1, 'user-1', 'ORDER_FILE', FILE), 'SIZE_MISMATCH');
  });

  it('reports a missing upload without deleting the reservation', async () => {
    m.fileFindFirst.mockResolvedValueOnce(pending);
    m.download.mockResolvedValue({ data: null, error: { message: 'not found' } });
    await expectCode(completeFileUpload(T1, 'user-1', 'ORDER_FILE', FILE), 'UPLOAD_MISSING');
    expect(m.fileUpdateMany).not.toHaveBeenCalled();
  });

  it('cannot complete another tenant\'s file', async () => {
    m.fileFindFirst.mockResolvedValueOnce(null);
    await expectCode(completeFileUpload(T2, 'user-1', 'ORDER_FILE', FILE), 'FILE_NOT_FOUND');
    expect(m.fileFindFirst.mock.calls[0][0].where.tenant_org_id).toBe(T2);
  });
});

describe('deleteFile', () => {
  it('soft-deletes only within the tenant and category', async () => {
    m.fileFindFirst.mockResolvedValueOnce({ entity_id: ORDER, purpose_code: 'BEFORE_IMAGE', status_code: 'READY' });
    await deleteFile(T1, 'user-1', 'ORDER_FILE', FILE);
    expect(m.fileFindFirst.mock.calls[0][0].where).toMatchObject({ id: FILE, tenant_org_id: T1, category_code: 'ORDER_FILE' });
    expect(m.fileUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: FILE, tenant_org_id: T1, category_code: 'ORDER_FILE' },
      data: { status_code: 'DELETED', rec_status: 0, is_active: false },
    });
  });

  it('reports not found for another tenant\'s file', async () => {
    m.fileFindFirst.mockResolvedValueOnce(null);
    await expectCode(deleteFile(T2, 'user-1', 'ORDER_FILE', FILE), 'FILE_NOT_FOUND');
    expect(m.fileUpdateMany).not.toHaveBeenCalled();
  });

  it('clears the organization logo URL when the main logo is deleted', async () => {
    m.fileFindFirst
      .mockResolvedValueOnce({ entity_id: T1, purpose_code: 'MAIN', status_code: 'READY' })
      .mockResolvedValueOnce(null); // slot is now empty
    await deleteFile(T1, 'user-1', 'TENANT_LOGO', FILE);
    expect(m.tenantUpdateMany).toHaveBeenCalledWith({ where: { id: T1 }, data: expect.objectContaining({ logo_url: null }) });
    expect(m.tenantUpdateMany.mock.calls[0][0].data).not.toHaveProperty('logo_dark_url');
  });

  it('clears only the dark logo URL when the dark logo is deleted', async () => {
    m.fileFindFirst
      .mockResolvedValueOnce({ entity_id: T1, purpose_code: 'DARK', status_code: 'READY' })
      .mockResolvedValueOnce(null); // slot is now empty
    await deleteFile(T1, 'user-1', 'TENANT_LOGO', FILE);
    expect(m.fileFindFirst.mock.calls[1][0].where).toMatchObject({ tenant_org_id: T1, purpose_code: 'DARK' });
    expect(m.tenantUpdateMany).toHaveBeenCalledWith({ where: { id: T1 }, data: expect.objectContaining({ logo_dark_url: null }) });
    expect(m.tenantUpdateMany.mock.calls[0][0].data).not.toHaveProperty('logo_url');
  });

  it('refuses to delete a locked file (proof of a completed record)', async () => {
    m.fileFindFirst.mockResolvedValueOnce({ entity_id: ORDER, purpose_code: 'DELIVERY_PROOF', status_code: 'READY', locked_at: new Date() });
    await expectCode(deleteFile(T1, 'user-1', 'ORDER_FILE', FILE), 'FILE_LOCKED');
    expect(m.fileUpdateMany).not.toHaveBeenCalled();
  });

  it('never deletes a file locked between the read and the write', async () => {
    m.fileFindFirst.mockResolvedValueOnce({ entity_id: ORDER, purpose_code: 'DELIVERY_PROOF', status_code: 'READY', locked_at: null });
    m.fileUpdateMany.mockResolvedValue({ count: 0 });
    await expectCode(deleteFile(T1, 'user-1', 'ORDER_FILE', FILE), 'FILE_LOCKED');
    expect(m.fileUpdateMany.mock.calls[0][0].where).toMatchObject({ locked_at: null, tenant_org_id: T1 });
  });

  it('leaves the URL alone for files outside the published slot', async () => {
    m.fileFindFirst.mockResolvedValueOnce({ entity_id: ORDER, purpose_code: 'GALLERY', status_code: 'READY' });
    await deleteFile(T1, 'user-1', 'PRODUCT_IMAGE', FILE);
    expect(m.productUpdateMany).not.toHaveBeenCalled();
  });
});

describe('updateFile', () => {
  it('does not re-check the size of a saved file when it moves purpose (limits apply to new uploads only)', async () => {
    m.fileFindFirst.mockResolvedValueOnce({ mime_type: 'image/jpeg', purpose_code: 'BEFORE_IMAGE', entity_id: ORDER, locked_at: null, size_bytes: BigInt(9 * 1048576) });
    // Target purpose allows only 1 MB now; the 9 MB file was valid when it was uploaded.
    m.purposeFindFirst.mockResolvedValue({ purpose_code: 'AFTER_IMAGE', max_files: null, max_size_bytes: BigInt(1048576) });
    m.fileFindFirst.mockResolvedValueOnce(null); // view after update (not needed for this check)
    await updateFile({ tenantId: T1, userId: 'user-1', categoryCode: 'ORDER_FILE', fileId: FILE, purposeCode: 'AFTER_IMAGE' }).catch(() => undefined);
    expect(m.fileUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ purpose_code: 'AFTER_IMAGE' }) }));
  });

  it('moving the main logo to the dark slot rewrites both logo URLs', async () => {
    m.fileFindFirst
      .mockResolvedValueOnce({ mime_type: 'image/png', purpose_code: 'MAIN', entity_id: T1, locked_at: null })
      .mockResolvedValueOnce(null) // MAIN slot is now empty
      .mockResolvedValueOnce(null) // DARK slot (no public URL in this mock)
      .mockResolvedValueOnce(null); // view after update
    m.purposeFindFirst.mockResolvedValue({ purpose_code: 'DARK', max_files: 1, max_size_bytes: null });
    await updateFile({ tenantId: T1, userId: 'user-1', categoryCode: 'TENANT_LOGO', fileId: FILE, purposeCode: 'DARK' }).catch(() => undefined);
    const data = m.tenantUpdateMany.mock.calls.map((c: [{ data: object }]) => c[0].data);
    expect(data).toEqual([expect.objectContaining({ logo_url: null }), expect.objectContaining({ logo_dark_url: null })]);
  });

  it('refuses to edit a locked file', async () => {
    m.fileFindFirst.mockResolvedValueOnce({ mime_type: 'image/jpeg', purpose_code: 'DELIVERY_PROOF', entity_id: ORDER, locked_at: new Date() });
    await expectCode(updateFile({ tenantId: T1, userId: 'user-1', categoryCode: 'ORDER_FILE', fileId: FILE, notes: 'x' }), 'FILE_LOCKED');
    expect(m.fileUpdateMany).not.toHaveBeenCalled();
  });
});

describe('published URL (PRODUCT_IMAGE / MAIN)', () => {
  it('publishes the public URL on the product, filtered by tenant, when the main image completes', async () => {
    const key = `${T1}/PRODUCT_IMAGE/${ORDER}/${FILE}.jpg`;
    m.bucketFind.mockResolvedValue({ storage_bucket_id: 'tenants-cmx-public', is_public: true });
    m.fileFindFirst
      .mockResolvedValueOnce({
        status_code: 'PENDING', bucket_code: 'TENANT_PUBLIC', object_key: key, thumb_object_key: null, mime_type: 'image/jpeg',
        size_bytes: BigInt(JPEG.length), purpose_code: 'MAIN', entity_id: ORDER, sys_file_purpose_cd: { max_files: 1 },
      })
      .mockResolvedValueOnce({ bucket_code: 'TENANT_PUBLIC', object_key: key }) // current slot file
      .mockResolvedValueOnce({
        id: FILE, category_code: 'PRODUCT_IMAGE', purpose_code: 'MAIN', entity_id: ORDER, ref_type_code: null, ref_id: null,
        source_code: 'PRODUCT_SETUP', notes: null, original_name: 'a.jpg', mime_type: 'image/jpeg', size_bytes: BigInt(JPEG.length),
        width: null, height: null, duration_ms: null, sort_order: 0, created_at: new Date(), created_by: 'user-1',
        bucket_code: 'TENANT_PUBLIC', object_key: key, thumb_object_key: null,
      });
    m.fileFindMany.mockResolvedValue([]);
    m.download.mockResolvedValue({ data: { arrayBuffer: async () => JPEG.buffer.slice(JPEG.byteOffset, JPEG.byteOffset + JPEG.length) }, error: null });

    await completeFileUpload(T1, 'user-1', 'PRODUCT_IMAGE', FILE);

    expect(m.productUpdateMany).toHaveBeenCalledWith({
      where: { id: ORDER, tenant_org_id: T1 },
      data: expect.objectContaining({ product_image: `https://pub/${key}` }),
    });
  });
});

describe('purgeDeletedFiles (file.purge.sweep, step 6e)', () => {
  const due = (tenant: string, id: string, thumb: string | null = null) => ({
    tenant_org_id: tenant,
    file_id: id,
    bucket_code: 'TENANT_FILES',
    object_key: `k/${id}`,
    thumb_object_key: thumb,
  });

  it('removes all keys of a bucket in one call and marks the rows of each tenant with that tenant filter', async () => {
    m.queryRaw.mockResolvedValue([due(T1, 'f1', 't/f1'), due(T2, 'f2')]);

    const out = await purgeDeletedFiles();

    expect(m.remove).toHaveBeenCalledTimes(1);
    expect(m.remove).toHaveBeenCalledWith(['k/f1', 't/f1', 'k/f2']);
    expect(m.fileUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_org_id: T1, id: { in: ['f1'] }, status_code: 'DELETED', purged_at: null },
    }));
    expect(m.fileUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_org_id: T2, id: { in: ['f2'] }, status_code: 'DELETED', purged_at: null },
    }));
    expect(out).toEqual({ purged: 2, failed: 0, nextPage: null });
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it('leaves rows unpurged and throws when storage refuses the removal', async () => {
    m.queryRaw.mockResolvedValue([due(T1, 'f1')]);
    m.remove.mockResolvedValue({ error: { message: 'storage down' } });

    await expect(purgeDeletedFiles()).rejects.toThrow('1 file(s) not purged');
    expect(m.fileUpdateMany).not.toHaveBeenCalled();
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it('queues the next page after a full batch', async () => {
    m.queryRaw.mockResolvedValue(Array.from({ length: FILE_PURGE_BATCH }, (_, i) => due(T1, `f${i}`)));
    m.fileUpdateMany.mockResolvedValue({ count: FILE_PURGE_BATCH });

    const out = await purgeDeletedFiles(3);

    expect(m.enqueue).toHaveBeenCalledWith(expect.anything(), 'file.purge.sweep', { page: 4 });
    expect(out.nextPage).toBe(4);
  });
});
