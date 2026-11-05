/**
 * HFC P4 (A-46): label printing PUT body and branchId query validation.
 */
import { labelPrintingSaveSchema, parseBranchIdParam } from '@/lib/validations/label-printing-schemas'

const B = '0b000000-0000-4000-8000-000000000001'
const row = (labelType: string, v: Record<string, unknown> = {}) => ({
  labelType,
  sizeCode: null,
  showQr: null,
  showCustomerName: null,
  showOrderBarcode: null,
  copies: null,
  ...v,
})

describe('labelPrintingSaveSchema', () => {
  it('accepts valid rows for the tenant or a branch', () => {
    expect(
      labelPrintingSaveSchema.safeParse({
        branchId: null,
        rows: [row('ORDER_LABEL', { sizeCode: '4x6in', showQr: true, copies: 3 }), row('PIECE_TAG'), row('RECEIPT', { showOrderBarcode: true })],
      }).success,
    ).toBe(true)
    expect(labelPrintingSaveSchema.safeParse({ branchId: B, rows: [row('PIECE_TAG', { sizeCode: '50x25mm' })] }).success).toBe(true)
  })

  it.each([
    ['size of another type', { branchId: null, rows: [row('PIECE_TAG', { sizeCode: '4x6in' })] }],
    ['field that does not apply', { branchId: null, rows: [row('RECEIPT', { copies: 2 })] }],
    ['customer name on a piece tag', { branchId: null, rows: [row('PIECE_TAG', { showCustomerName: true })] }],
    ['copies out of range', { branchId: null, rows: [row('ORDER_LABEL', { copies: 11 })] }],
    ['copies zero', { branchId: null, rows: [row('ORDER_LABEL', { copies: 0 })] }],
    ['repeated type', { branchId: null, rows: [row('RECEIPT'), row('RECEIPT')] }],
    ['unknown type', { branchId: null, rows: [row('BAG')] }],
    ['bad branch id', { branchId: 'x', rows: [row('RECEIPT')] }],
    ['no rows', { branchId: null, rows: [] }],
  ])('rejects %s', (_name, body) => {
    expect(labelPrintingSaveSchema.safeParse(body).success).toBe(false)
  })
})

describe('parseBranchIdParam', () => {
  it('maps absent/empty to null, uuid to itself, other values to undefined', () => {
    expect(parseBranchIdParam(null)).toBeNull()
    expect(parseBranchIdParam('')).toBeNull()
    expect(parseBranchIdParam(B)).toBe(B)
    expect(parseBranchIdParam('nope')).toBeUndefined()
  })
})
