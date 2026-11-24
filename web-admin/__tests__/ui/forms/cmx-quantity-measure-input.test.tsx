import '@testing-library/jest-dom'
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('next-intl', () => {
  const catalog = jest.requireActual('@/messages/en/uom.json') as {
    measure: Record<string, string>
  }
  return {
    useTranslations: () => (key: string, values?: Record<string, string>) => {
      const msg = catalog.measure[key] ?? key
      return msg.replace(/\{(\w+)\}/g, (_, k: string) => values?.[k] ?? '')
    },
  }
})

import { CmxQuantityMeasureInput } from '@ui/forms/cmx-quantity-measure-input'

describe('CmxQuantityMeasureInput', () => {
  it('associates its label with the input and trims decimals to qtyDecimals', () => {
    const onChange = jest.fn()
    render(
      <CmxQuantityMeasureInput
        dimension="MASS"
        unitSymbol="kg"
        qtyDecimals={2}
        value={{ measuredQty: '', length: '', width: '' }}
        onChange={onChange}
        billedPreview="3.5 kg"
      />,
    )

    const input = screen.getByLabelText('Measure (kg)')
    expect(input).toHaveAttribute('dir', 'ltr')
    fireEvent.change(input, { target: { value: '1,2345' } })
    expect(onChange).toHaveBeenCalledWith({ measuredQty: '1.23', length: '', width: '' })

    const preview = screen.getByRole('status')
    expect(preview).toHaveTextContent('Billed: 3.5 kg')
  })

  it('associates Length and Width labels in AREA mode and wires error to both fields', () => {
    const onChange = jest.fn()
    render(
      <CmxQuantityMeasureInput
        dimension="AREA"
        unitSymbol="m²"
        qtyDecimals={2}
        value={{ measuredQty: '', length: '2', width: '' }}
        onChange={onChange}
        error="Enter width"
      />,
    )

    const lengthInput = screen.getByLabelText('Length (m)')
    const widthInput = screen.getByLabelText('Width (m)')
    expect(lengthInput).toHaveAttribute('aria-invalid', 'true')
    expect(widthInput).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter width')

    fireEvent.change(widthInput, { target: { value: '1.5' } })
    expect(onChange).toHaveBeenCalledWith({ measuredQty: '', length: '2', width: '1.5' })
  })
})
