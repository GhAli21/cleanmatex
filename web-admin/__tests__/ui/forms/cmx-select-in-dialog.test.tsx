import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms/cmx-select-dropdown'
import { CmxDialog, CmxDialogContent } from '@ui/overlays/cmx-dialog'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
  global.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never
})

test('Escape in a select inside a dialog closes only the list', () => {
  const onDialogOpenChange = jest.fn()
  render(
    <CmxDialog open onOpenChange={onDialogOpenChange}>
      <CmxDialogContent>
        <CmxSelectDropdown value="A" onValueChange={() => {}}>
          <CmxSelectDropdownTrigger aria-label="Pick">
            <CmxSelectDropdownValue displayValue="Alpha" />
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            <CmxSelectDropdownItem value="A">Alpha</CmxSelectDropdownItem>
            <CmxSelectDropdownItem value="B">Beta</CmxSelectDropdownItem>
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>
      </CmxDialogContent>
    </CmxDialog>
  )
  act(() => { fireEvent.keyDown(screen.getByRole('combobox', { name: 'Pick' }), { key: 'Enter' }) })
  act(() => { fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' }) })
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(onDialogOpenChange).not.toHaveBeenCalledWith(false)
})

test('the list sits on the popover layer, above every dialog', () => {
  render(
    <CmxSelectDropdown value="A" onValueChange={() => {}}>
      <CmxSelectDropdownTrigger aria-label="Pick">
        <CmxSelectDropdownValue displayValue="Alpha" />
      </CmxSelectDropdownTrigger>
      <CmxSelectDropdownContent>
        <CmxSelectDropdownItem value="A">Alpha</CmxSelectDropdownItem>
      </CmxSelectDropdownContent>
    </CmxSelectDropdown>
  )
  act(() => { fireEvent.keyDown(screen.getByRole('combobox', { name: 'Pick' }), { key: 'Enter' }) })
  expect(screen.getByRole('listbox').closest('.z-\\[var\\(--cmx-z-popover\\)\\]')).not.toBeNull()
})
