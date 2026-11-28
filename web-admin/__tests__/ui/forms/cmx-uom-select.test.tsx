import '@testing-library/jest-dom'
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

let mockLocale = 'en'
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}))

import { CmxUomSelect } from '@ui/forms/cmx-uom-select'

const UNITS = [
  { code: 'KG', name: 'Kilogram', name2: 'كيلوغرام', symbol: 'kg', symbol2: 'كجم', dimension: 'MASS' as const, isActive: true },
  { code: 'LB', name: 'Pound', name2: 'رطل', symbol: 'lb', symbol2: 'رطل', dimension: 'MASS' as const, isActive: false },
  { code: 'PC', name: 'Piece', name2: 'قطعة', symbol: 'pc', symbol2: 'قطعة', dimension: 'COUNT' as const, isActive: true },
  { code: 'BASKET', name: 'Basket', name2: 'سلة', symbol: 'bsk', symbol2: 'سلة', dimension: 'COUNT' as const, isActive: true, origin: 'CUSTOM' as const },
]

const optionTexts = () => screen.queryAllByRole('option').map((o) => o.textContent)

function Harness(props: { initial?: string; dimension?: 'MASS'; onChange?: (code: string) => void }) {
  const [value, setValue] = React.useState(props.initial ?? '')
  return (
    <CmxUomSelect
      label="Unit"
      units={UNITS}
      dimension={props.dimension}
      value={value}
      onChange={(code) => { setValue(code); props.onChange?.(code) }}
    />
  )
}

describe('CmxUomSelect', () => {
  beforeEach(() => {
    mockLocale = 'en'
  })

  it('groups by dimension, tags custom units and hides switched-off ones', () => {
    render(<Harness />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('combobox', { name: /Unit/ }))
    expect(optionTexts()).toEqual(['PC — Piece (pc)', 'BASKET — Basket (bsk)uom.origin.CUSTOM', 'KG — Kilogram (kg)'])
    expect(screen.getByText('uom.dimensions.COUNT')).toBeInTheDocument()
    expect(screen.getByText('uom.dimensions.MASS')).toBeInTheDocument()
  })

  it('finds a unit by typing, in either language, and picks it with the keyboard', () => {
    const onChange = jest.fn()
    render(<Harness onChange={onChange} />)
    const input = screen.getByRole('combobox', { name: /Unit/ })
    fireEvent.change(input, { target: { value: 'سلة' } })
    expect(optionTexts()).toHaveLength(1)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('BASKET')
    expect(input).toHaveValue('BASKET — Basket (bsk)')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('moves with the arrows, closes on Escape without changing, and says when nothing matches', () => {
    const onChange = jest.fn()
    render(<Harness initial="PC" onChange={onChange} />)
    const input = screen.getByRole('combobox', { name: /Unit/ })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toContain('-1')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onChange).not.toHaveBeenCalled()
    expect(input).toHaveValue('PC — Piece (pc)')
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByText('common.noData')).toBeInTheDocument()
  })

  it('limits to a dimension, keeps the current switched-off unit and uses Arabic labels', () => {
    mockLocale = 'ar'
    render(<Harness initial="LB" dimension="MASS" />)
    fireEvent.click(screen.getByRole('combobox', { name: /Unit/ }))
    expect(optionTexts()).toEqual(['KG — كيلوغرام (كجم)', 'LB — رطل (رطل)'])
  })
})
