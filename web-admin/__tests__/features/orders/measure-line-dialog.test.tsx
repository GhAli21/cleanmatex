/**
 * Measure dialog (P4): staff enter a measure; the billed preview uses the server's own resolver;
 * confirm is only possible for a measure the server would accept.
 */
import '@testing-library/jest-dom'
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('next-intl', () => {
  const catalog: Record<string, unknown> = {
    uom: jest.requireActual('@/messages/en/uom.json'),
    common: jest.requireActual('@/messages/en/common.json'),
  }
  const translator = (ns: string) => {
    const [first, ...rest] = ns.split('.')
    const root = rest.reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], catalog[first])
    const t = (key: string, values?: Record<string, string>) => {
      const msg = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], root)
      if (typeof msg !== 'string') return `${ns}.${key}`
      return msg.replace(/\{(\w+)\}/g, (_, k: string) => values?.[k] ?? '')
    }
    t.has = (key: string) => typeof key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], root) === 'string'
    return t
  }
  return { useTranslations: translator, useLocale: () => 'en' }
})

import { MeasureLineDialog } from '@features/orders/ui/measure-line-dialog'

const KG = { code: 'KG', dimension: 'MASS', qtyDecimals: 3, symbol: 'kg', symbol2: null, minBillableQty: '3', billingIncrement: '0.5' }
const M2 = { code: 'SQM', dimension: 'AREA', qtyDecimals: 3, symbol: 'm²', symbol2: null, minBillableQty: null, billingIncrement: null }

function setup(uom = KG, initial?: { measuredQty: string; length: string; width: string }) {
  const onConfirm = jest.fn()
  render(<MeasureLineDialog open productName="Carpet" uom={uom} initial={initial} onConfirm={onConfirm} onClose={jest.fn()} />)
  return { onConfirm }
}

describe('MeasureLineDialog', () => {
  it('starts with confirm disabled and no error shouting', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(screen.queryByText(/Enter the measure/)).not.toBeInTheDocument()
  })

  it('previews the billed measure (3.2 kg, step 0.5 → 3.5 kg) and confirms the typed measure', () => {
    const { onConfirm } = setup()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3.2' } })
    expect(screen.getByText('Billed: 3.5 kg')).toBeInTheDocument()
    expect(screen.getByText('Rounded up to the billing step.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onConfirm).toHaveBeenCalledWith({ measuredQty: '3.2', length: '', width: '' })
  })

  it('lists the product minimum and step', () => {
    setup()
    expect(screen.getByText('Minimum billed: 3 kg')).toBeInTheDocument()
    expect(screen.getByText('Billed in steps of 0.5 kg')).toBeInTheDocument()
  })

  it('cannot type more decimals than the unit allows', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '1.23456' } })
    expect(input).toHaveValue('1.234')
  })

  it('an area unit asks for length and width and bills their product', () => {
    const { onConfirm } = setup(M2)
    const [length, width] = screen.getAllByRole('textbox')
    fireEvent.change(length, { target: { value: '2' } })
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled() // width missing
    fireEvent.change(width, { target: { value: '1.5' } })
    expect(screen.getByText('Billed: 3 m²')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onConfirm).toHaveBeenCalledWith({ measuredQty: '', length: '2', width: '1.5' })
  })

  it('re-measuring an item in the cart starts from its measure and says Save', () => {
    setup(KG, { measuredQty: '4', length: '', width: '' })
    expect(screen.getByRole('textbox')).toHaveValue('4')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  // Cart Line Grouping §4.1: a line with this measure is already in the order.
  it('Add shows the choice when a line can take the article; staff pick the line, a new line, or go back', () => {
    const onConfirm = jest.fn()
    const onMerge = jest.fn()
    const mergeChoice = jest.fn(() => ({
      title: 'A line with this measure is already in the order',
      options: [{ lineKey: 'line-1', label: 'Add to line 1', result: 'Becomes 2 pieces · 7 kg' }],
      newLineLabel: 'Add as a new line',
    }))
    render(<MeasureLineDialog open productName="Carpet" uom={KG} mergeChoice={mergeChoice} onMerge={onMerge} onConfirm={onConfirm} onClose={jest.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(mergeChoice).toHaveBeenCalledWith(expect.objectContaining({ measuredQty: '3.5' }))
    expect(screen.getByText('A line with this measure is already in the order')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('textbox')).toHaveValue('3.5')

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('button', { name: /Add to line 1/ }))
    expect(onMerge).toHaveBeenCalledWith('line-1', expect.objectContaining({ measuredQty: '3.5' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Add without a matching line adds a new line at once', () => {
    const onConfirm = jest.fn()
    render(<MeasureLineDialog open productName="Carpet" uom={KG} mergeChoice={() => null} onMerge={jest.fn()} onConfirm={onConfirm} onClose={jest.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ measuredQty: '3.5' }))
  })
})

describe('MeasureLineDialog: another unit and the keypad', () => {
  const KG_UNITS = [
    { code: 'KG', symbol: 'kg', symbol2: null, qtyDecimals: 3, rate: '1' },
    { code: 'LB', symbol: 'lb', symbol2: null, qtyDecimals: 3, rate: '0.45359237' },
  ]
  const METRES = [
    { code: 'M', symbol: 'm', symbol2: null, qtyDecimals: 2, rate: '1' },
    { code: 'FT', symbol: 'ft', symbol2: null, qtyDecimals: 3, rate: '0.3048' },
  ]

  it('converts pounds into the product unit, shows both, and saves the product unit', () => {
    const onConfirm = jest.fn()
    render(<MeasureLineDialog open productName="Wash" uom={KG} entryUnits={KG_UNITS} onConfirm={onConfirm} onClose={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'LB' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Measure (lb)' }), { target: { value: '10' } })
    expect(screen.getByText('10 lb = 4.536 kg')).toBeInTheDocument()
    expect(screen.getByText('Billed: 5 kg')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onConfirm).toHaveBeenCalledWith({ measuredQty: '4.536', length: '', width: '' })
  })

  it('changing the unit clears the typed figure instead of rereading it', () => {
    render(<MeasureLineDialog open productName="Wash" uom={KG} entryUnits={KG_UNITS} onConfirm={jest.fn()} onClose={jest.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '5' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'LB' } })
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('takes a rug in feet and saves metres', () => {
    const onConfirm = jest.fn()
    render(<MeasureLineDialog open productName="Rug" uom={M2} entryUnits={METRES} onConfirm={onConfirm} onClose={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'FT' } })
    const [length, width] = screen.getAllByRole('textbox')
    fireEvent.change(length, { target: { value: '8' } })
    fireEvent.change(width, { target: { value: '10' } })
    expect(screen.getByText('8 ft × 10 ft = 2.4384 m × 3.048 m')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onConfirm).toHaveBeenCalledWith({ measuredQty: '', length: '2.4384', width: '3.048' })
  })

  it('hides the unit choice when there is only the product unit', () => {
    render(<MeasureLineDialog open productName="Wash" uom={KG} entryUnits={[KG_UNITS[0]]} onConfirm={jest.fn()} onClose={jest.fn()} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('types with the on-screen keypad', () => {
    const onConfirm = jest.fn()
    render(<MeasureLineDialog open productName="Wash" uom={KG} onConfirm={onConfirm} onClose={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Keypad' }))
    for (const key of ['4', 'Decimal point', '2']) fireEvent.click(screen.getByRole('button', { name: key }))
    expect(screen.getByRole('textbox')).toHaveValue('4.2')
    fireEvent.click(screen.getByRole('button', { name: 'Delete last digit' }))
    expect(screen.getByRole('textbox')).toHaveValue('4.')
  })
})

describe('MeasureLineDialog: square feet', () => {
  const SQFT = { code: 'SQFT', dimension: 'AREA', qtyDecimals: 2, symbol: 'ft²', symbol2: null, minBillableQty: null, billingIncrement: null }

  it('asks for feet even before the units load, and bills square feet', () => {
    const onConfirm = jest.fn()
    render(<MeasureLineDialog open productName="Rug" uom={SQFT} onConfirm={onConfirm} onClose={jest.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Length (ft)' }), { target: { value: '8' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Width (ft)' }), { target: { value: '10' } })
    expect(screen.getByText('Billed: 80 ft²')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onConfirm).toHaveBeenCalledWith({ measuredQty: '', length: '8', width: '10' })
  })

  it('takes metres on a square-foot product and saves feet', () => {
    const onConfirm = jest.fn()
    const units = [
      { code: 'FT', symbol: 'ft', symbol2: null, qtyDecimals: 2, rate: '1' },
      { code: 'M', symbol: 'm', symbol2: null, qtyDecimals: 2, rate: '3.280839895013' },
    ]
    render(<MeasureLineDialog open productName="Rug" uom={SQFT} entryUnits={units} onConfirm={onConfirm} onClose={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'M' } })
    const [length, width] = screen.getAllByRole('textbox')
    fireEvent.change(length, { target: { value: '2' } })
    fireEvent.change(width, { target: { value: '3' } })
    expect(screen.getByText('2 m × 3 m = 6.5617 ft × 9.8425 ft')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onConfirm).toHaveBeenCalledWith({ measuredQty: '', length: '6.5617', width: '9.8425' })
  })

  it('refuses an area unit it cannot measure', () => {
    render(<MeasureLineDialog open productName="Rug" uom={{ ...SQFT, code: 'BLOCK' }} onConfirm={jest.fn()} onClose={jest.fn()} />)
    const [length, width] = screen.getAllByRole('textbox')
    fireEvent.change(length, { target: { value: '1' } })
    fireEvent.change(width, { target: { value: '1' } })
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Only square metres and square feet')
  })
})

