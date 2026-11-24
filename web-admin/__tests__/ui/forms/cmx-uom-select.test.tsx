import '@testing-library/jest-dom'
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

let mockLocale = 'en'
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
}))

import { CmxUomSelect } from '@ui/forms/cmx-uom-select'

const UNITS = [
  { code: 'PC', name: 'Piece', name2: 'قطعة', symbol: 'pc', symbol2: 'قطعة', dimension: 'COUNT' as const, isActive: true },
  { code: 'KG', name: 'Kilogram', name2: 'كيلوغرام', symbol: 'kg', symbol2: 'كجم', dimension: 'MASS' as const, isActive: true },
  { code: 'LB', name: 'Pound', name2: 'رطل', symbol: 'lb', symbol2: 'رطل', dimension: 'MASS' as const, isActive: false },
]

describe('CmxUomSelect', () => {
  beforeEach(() => {
    mockLocale = 'en'
  })

  it('filters by dimension, hides inactive units unless selected, and emits code on change', () => {
    const onChange = jest.fn()
    render(
      <CmxUomSelect
        label="Unit"
        units={UNITS}
        dimension="MASS"
        value="KG"
        onChange={onChange}
      />,
    )

    const select = screen.getByLabelText('Unit')
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
    expect(options).toEqual(['KG — Kilogram (kg)'])

    fireEvent.change(select, { target: { value: 'KG' } })
    expect(onChange).toHaveBeenCalledWith('KG')
  })

  it('keeps an inactive unit visible when it is the current value and localizes labels in Arabic', () => {
    mockLocale = 'ar'
    render(
      <CmxUomSelect
        label="الوحدة"
        units={UNITS}
        value="LB"
        onChange={jest.fn()}
      />,
    )

    const select = screen.getByLabelText('الوحدة')
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
    expect(options).toEqual([
      'PC — قطعة (قطعة)',
      'KG — كيلوغرام (كجم)',
      'LB — رطل (رطل)',
    ])
  })
})
