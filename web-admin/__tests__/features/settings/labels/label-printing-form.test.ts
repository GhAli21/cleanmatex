/**
 * HFC P4 (A-49): label settings form model - encode/decode, inherited values per scope, save rows, change count.
 */
import {
  INHERIT,
  countChanges,
  decodeValue,
  fieldOptions,
  inheritedValue,
  toFormValues,
  toSaveRows,
} from '@features/settings/labels/model/label-printing-form'
import type { LabelPrintingValues } from '@/lib/services/labels/label-types'

const row = (labelType: LabelPrintingValues['labelType'], v: Partial<LabelPrintingValues> = {}): LabelPrintingValues => ({
  labelType,
  sizeCode: null,
  showQr: null,
  showCustomerName: null,
  showOrderBarcode: null,
  copies: null,
  ...v,
})

const SYSTEM = [
  row('ORDER_LABEL', { sizeCode: '4x6in', showQr: true, showCustomerName: true, copies: 1 }),
  row('PIECE_TAG', { sizeCode: '58x30mm', showQr: false, copies: 1 }),
  row('RECEIPT', { showOrderBarcode: false }),
]

describe('label printing form model', () => {
  it('toFormValues has every applicable field, INHERIT for null', () => {
    const v = toFormValues([row('ORDER_LABEL', { sizeCode: '80mm', showQr: false, copies: 2 })])
    expect(v.ORDER_LABEL).toEqual({ sizeCode: '80mm', showQr: 'false', showCustomerName: INHERIT, copies: '2' })
    expect(v.PIECE_TAG).toEqual({ sizeCode: INHERIT, showQr: INHERIT, copies: INHERIT })
    expect(v.RECEIPT).toEqual({ showOrderBarcode: INHERIT })
  })

  it('toSaveRows round-trips and sends all-null rows for inherited types', () => {
    const overrides = [row('ORDER_LABEL', { sizeCode: '80mm', showQr: false, copies: 2 }), row('RECEIPT', { showOrderBarcode: true })]
    expect(toSaveRows(toFormValues(overrides))).toEqual([overrides[0], row('PIECE_TAG'), overrides[1]])
  })

  it('decodeValue rejects values that are not valid for the field', () => {
    expect(decodeValue('copies', '11')).toBeNull()
    expect(decodeValue('copies', '3')).toBe(3)
    expect(decodeValue('showQr', 'maybe')).toBeNull()
    expect(decodeValue('sizeCode', INHERIT)).toBeNull()
  })

  it('inheritedValue: tenant scope = system; branch scope = tenant override, else system', () => {
    const cfg = { systemDefaults: SYSTEM, tenantOverrides: [row('ORDER_LABEL', { sizeCode: '58mm' })] }
    expect(inheritedValue(cfg, 'tenant', 'ORDER_LABEL', 'sizeCode')).toBe('4x6in')
    expect(inheritedValue(cfg, 'branch', 'ORDER_LABEL', 'sizeCode')).toBe('58mm')
    expect(inheritedValue(cfg, 'branch', 'ORDER_LABEL', 'copies')).toBe('1')
    expect(inheritedValue(cfg, 'branch', 'RECEIPT', 'showOrderBarcode')).toBe('false')
    expect(inheritedValue({ systemDefaults: [], tenantOverrides: [] }, 'tenant', 'PIECE_TAG', 'sizeCode')).toBeNull()
  })

  it('fieldOptions and countChanges', () => {
    expect(fieldOptions('PIECE_TAG', 'sizeCode')).toEqual(['58x30mm', '50x25mm', '80x40mm'])
    expect(fieldOptions('ORDER_LABEL', 'copies')).toHaveLength(10)
    expect(fieldOptions('RECEIPT', 'showOrderBarcode')).toEqual(['true', 'false'])
    const saved = toFormValues([])
    const edited = { ...saved, RECEIPT: { showOrderBarcode: 'true' }, PIECE_TAG: { ...saved.PIECE_TAG, copies: '2' } }
    expect(countChanges(saved, saved)).toBe(0)
    expect(countChanges(saved, edited)).toBe(2)
  })
})
