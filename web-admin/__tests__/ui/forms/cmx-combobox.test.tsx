/** CmxCombobox inside a dialog: Escape closes the open list first; only a second Escape closes the dialog. */
import '@testing-library/jest-dom'
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import { CmxCombobox } from '@ui/forms/cmx-combobox'
import { CmxDialog, CmxDialogContent } from '@ui/overlays/cmx-dialog'

const options = [{ value: 'KG', label: 'Kilogram' }, { value: 'LB', label: 'Pound', disabled: true }]

describe('CmxCombobox', () => {
  it('keeps the dialog open when Escape closes the list', () => {
    const onOpenChange = jest.fn()
    render(
      <CmxDialog open onOpenChange={onOpenChange}>
        <CmxDialogContent>
          <CmxCombobox label="Unit" options={options} value="" onChange={jest.fn()} />
        </CmxDialogContent>
      </CmxDialog>,
    )
    const input = screen.getByRole('combobox', { name: 'Unit' })
    fireEvent.click(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not pick a disabled option, and closes when focus leaves', () => {
    const onChange = jest.fn()
    render(<CmxCombobox label="Unit" options={options} value="KG" onChange={onChange} />)
    const input = screen.getByRole('combobox', { name: 'Unit' })
    expect(input).not.toHaveAttribute('aria-controls')
    fireEvent.click(input)
    fireEvent.click(screen.getByRole('option', { name: 'Pound' }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
