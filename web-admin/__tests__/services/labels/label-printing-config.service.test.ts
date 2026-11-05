/**
 * @jest-environment node
 *
 * HFC P4 (A-46/A-47): LabelPrintingConfigService reads sys_label_printing_cf / org_label_printing_cf, resolves via
 * fn_label_printing_resolve, and saves overrides of one scope (update, insert, or delete when all values are null).
 */
import {
  LabelPrintingConfigError,
  LabelPrintingConfigService,
  isEmptyOverride,
  normalizeOverride,
  toResolved,
} from '@/lib/services/labels/label-printing-config.service'
import type { LabelPrintingValues } from '@/lib/services/labels/label-types'
import { createSupabaseMock, hasOp } from '../../helpers/label-printing-supabase-mock'

const T = 't1'
const B = 'b1'
const empty = (labelType: LabelPrintingValues['labelType']): LabelPrintingValues => ({
  labelType,
  sizeCode: null,
  showQr: null,
  showCustomerName: null,
  showOrderBarcode: null,
  copies: null,
})

describe('pure helpers', () => {
  it('toResolved maps columns and sources and drops unknown types', () => {
    expect(
      toResolved({
        label_type: 'ORDER_LABEL',
        size_code: '80mm',
        show_qr: false,
        show_customer_name: true,
        show_order_barcode: null,
        copies: 2,
        show_order_barcode_configured: null,
        value_sources: { size_code: 'BRANCH', show_qr: 'TENANT', copies: 'SYSTEM', junk: 'X', show_customer_name: 'NOPE' },
      }),
    ).toEqual({
      labelType: 'ORDER_LABEL',
      sizeCode: '80mm',
      showQr: false,
      showCustomerName: true,
      showOrderBarcode: null,
      copies: 2,
      showOrderBarcodeConfigured: null,
      sources: { sizeCode: 'BRANCH', showQr: 'TENANT', copies: 'SYSTEM' },
    })
    expect(toResolved({ label_type: 'OTHER' } as never)).toBeNull()
  })

  it('normalizeOverride clears fields that do not apply; isEmptyOverride', () => {
    expect(normalizeOverride({ ...empty('RECEIPT'), sizeCode: '80mm', copies: 3, showOrderBarcode: true })).toEqual({
      ...empty('RECEIPT'),
      showOrderBarcode: true,
    })
    expect(normalizeOverride({ ...empty('PIECE_TAG'), showCustomerName: true, copies: 2 })).toEqual({
      ...empty('PIECE_TAG'),
      copies: 2,
    })
    expect(isEmptyOverride(empty('ORDER_LABEL'))).toBe(true)
    expect(isEmptyOverride({ ...empty('ORDER_LABEL'), showQr: false })).toBe(false)
  })
})

describe('reads', () => {
  it('resolve calls the RPC with tenant and branch and maps rows', async () => {
    const m = createSupabaseMock(() => ({ data: [], error: null }))
    m.rpc.mockResolvedValue({
      data: [{ label_type: 'PIECE_TAG', size_code: '58x30mm', show_qr: false, show_customer_name: null, show_order_barcode: null, copies: 1, show_order_barcode_configured: null, value_sources: {} }],
      error: null,
    })
    const rows = await LabelPrintingConfigService.resolve(m.client, T, B)
    expect(m.rpc).toHaveBeenCalledWith('fn_label_printing_resolve', { p_tenant_id: T, p_branch_id: B })
    expect(rows[0]).toMatchObject({ labelType: 'PIECE_TAG', sizeCode: '58x30mm', copies: 1 })
  })

  it('resolve throws LOAD_FAILED on an RPC error', async () => {
    const m = createSupabaseMock(() => ({ data: [], error: null }))
    m.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(LabelPrintingConfigService.resolve(m.client, T, null)).rejects.toMatchObject({ code: 'LOAD_FAILED' })
  })

  it('getOverrides filters by tenant and scope (branch_id IS NULL for tenant-wide)', async () => {
    const m = createSupabaseMock(() => ({ data: [{ label_type: 'RECEIPT', show_order_barcode: true }], error: null }))
    const tenantRows = await LabelPrintingConfigService.getOverrides(m.client, T, null)
    await LabelPrintingConfigService.getOverrides(m.client, T, B)
    expect(tenantRows).toEqual([{ ...empty('RECEIPT'), showOrderBarcode: true }])
    expect(m.calls[0].table).toBe('org_label_printing_cf')
    expect(hasOp(m.calls[0].ops, 'eq', 'tenant_org_id', T)).toBe(true)
    expect(hasOp(m.calls[0].ops, 'is', 'branch_id', null)).toBe(true)
    expect(hasOp(m.calls[1].ops, 'eq', 'branch_id', B)).toBe(true)
  })

  it('getConfig skips the branch query for the tenant scope', async () => {
    const m = createSupabaseMock(() => ({ data: [], error: null }))
    m.rpc.mockResolvedValue({ data: [], error: null })
    const cfg = await LabelPrintingConfigService.getConfig(m.client, T, null)
    expect(cfg).toEqual({ systemDefaults: [], tenantOverrides: [], branchOverrides: [], effective: [] })
    expect(m.calls.map((c) => c.table)).toEqual(['sys_label_printing_cf', 'org_label_printing_cf'])
  })
})

describe('saveOverrides', () => {
  it('updates an existing row, inserts a new one and deletes an all-null one', async () => {
    const existing: Record<string, string | null> = { ORDER_LABEL: 'r1', PIECE_TAG: null, RECEIPT: 'r3' }
    const m = createSupabaseMock((_table, ops) => {
      if (ops.some((o) => o.method === 'maybeSingle')) {
        const type = ops.find((o) => o.method === 'eq' && o.args[0] === 'label_type')!.args[1] as string
        return { data: existing[type] ? { id: existing[type] } : null, error: null }
      }
      return { data: null, error: null }
    })
    await LabelPrintingConfigService.saveOverrides(m.client, {
      tenantId: T,
      branchId: B,
      userId: 'u1',
      userInfo: 'ua',
      rows: [
        { ...empty('ORDER_LABEL'), sizeCode: '80mm', copies: 2 },
        { ...empty('PIECE_TAG'), showQr: true },
        empty('RECEIPT'),
      ],
    })
    const writes = m.calls.filter((c) => !c.ops.some((o) => o.method === 'maybeSingle'))
    const [upd, ins, del] = writes
    const updOp = upd.ops.find((o) => o.method === 'update')!
    expect(updOp.args[0]).toMatchObject({ size_code: '80mm', copies: 2, show_qr: null, updated_by: 'u1', updated_info: 'ua', is_active: true })
    expect(hasOp(upd.ops, 'eq', 'id', 'r1')).toBe(true)
    expect(ins.ops.find((o) => o.method === 'insert')!.args[0]).toMatchObject({
      tenant_org_id: T,
      branch_id: B,
      label_type: 'PIECE_TAG',
      show_qr: true,
      created_by: 'u1',
    })
    expect(del.ops.some((o) => o.method === 'delete')).toBe(true)
    expect(hasOp(del.ops, 'eq', 'tenant_org_id', T)).toBe(true)
    expect(hasOp(del.ops, 'eq', 'id', 'r3')).toBe(true)
    // lookups are scoped to the branch
    expect(m.calls.filter((c) => hasOp(c.ops, 'eq', 'branch_id', B)).length).toBe(3)
  })

  it('does nothing for an all-null row that has no override', async () => {
    const m = createSupabaseMock(() => ({ data: null, error: null }))
    await LabelPrintingConfigService.saveOverrides(m.client, { tenantId: T, branchId: null, userId: null, rows: [empty('RECEIPT')] })
    expect(m.calls).toHaveLength(1)
    expect(hasOp(m.calls[0].ops, 'is', 'branch_id', null)).toBe(true)
  })

  it('rejects repeated label types and reports write errors as SAVE_FAILED', async () => {
    const m = createSupabaseMock(() => ({ data: null, error: null }))
    await expect(
      LabelPrintingConfigService.saveOverrides(m.client, { tenantId: T, branchId: null, userId: null, rows: [empty('RECEIPT'), empty('RECEIPT')] }),
    ).rejects.toBeInstanceOf(LabelPrintingConfigError)

    const bad = createSupabaseMock((_t, ops) =>
      ops.some((o) => o.method === 'insert') ? { data: null, error: { message: 'nope' } } : { data: null, error: null },
    )
    await expect(
      LabelPrintingConfigService.saveOverrides(bad.client, { tenantId: T, branchId: null, userId: null, rows: [{ ...empty('RECEIPT'), showOrderBarcode: true }] }),
    ).rejects.toMatchObject({ code: 'SAVE_FAILED' })
  })
})
