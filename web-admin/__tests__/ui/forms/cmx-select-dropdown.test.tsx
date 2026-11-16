import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms/cmx-select-dropdown'

beforeAll(() => {
  // jsdom lacks these; Radix calls them on open.
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
  global.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never
})

function Harness(props: {
  value?: string
  onValueChange?: (v: string) => void
  onOpenChange?: (o: boolean) => void
  isLoading?: boolean
  disabled?: boolean
  items?: Array<[string, string]>
}) {
  const items = props.items ?? [['', 'None'], ['A', 'Alpha'], ['B', 'Beta']]
  return (
    <CmxSelectDropdown
      value={props.value}
      onValueChange={props.onValueChange ?? (() => {})}
      onOpenChange={props.onOpenChange}
      isLoading={props.isLoading}
      disabled={props.disabled}
      emptyLabel="Nothing here"
      loadingLabel="Loading…"
    >
      <CmxSelectDropdownTrigger aria-label="Pick">
        <CmxSelectDropdownValue placeholder="Choose" displayValue={items.find(([v]) => v === props.value)?.[1]} />
      </CmxSelectDropdownTrigger>
      <CmxSelectDropdownContent>
        {items.map(([v, l]) => (
          <CmxSelectDropdownItem key={v || 'none'} value={v}>{l}</CmxSelectDropdownItem>
        ))}
      </CmxSelectDropdownContent>
    </CmxSelectDropdown>
  )
}

const trigger = () => screen.getByRole('combobox', { name: 'Pick' })
const open = () => act(() => { fireEvent.keyDown(trigger(), { key: 'Enter' }) })

test('trigger shows the display value, or the placeholder without one', () => {
  const { rerender } = render(<Harness value="A" />)
  expect(trigger()).toHaveTextContent('Alpha')
  rerender(<Harness value={undefined} />)
  expect(trigger()).toHaveTextContent('Choose')
})

test('choosing an item calls onValueChange once with its value', () => {
  const onValueChange = jest.fn()
  render(<Harness value="A" onValueChange={onValueChange} />)
  open()
  fireEvent.click(screen.getByRole('option', { name: 'Beta' }))
  expect(onValueChange).toHaveBeenCalledTimes(1)
  expect(onValueChange).toHaveBeenCalledWith('B')
})

test('an item with an empty-string value can be chosen and reports ""', () => {
  const onValueChange = jest.fn()
  render(<Harness value="A" onValueChange={onValueChange} />)
  open()
  fireEvent.click(screen.getByRole('option', { name: 'None' }))
  expect(onValueChange).toHaveBeenCalledWith('')
})

test('Escape closes the list and returns focus to the trigger', async () => {
  render(<Harness value="A" />)
  open()
  expect(screen.getByRole('listbox')).toBeInTheDocument()
  act(() => { fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' }) })
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  await waitFor(() => expect(trigger()).toHaveFocus())
})

test('loading and empty states show their labels', () => {
  const { unmount } = render(<Harness isLoading />)
  open()
  expect(screen.getByText('Loading…')).toBeInTheDocument()
  unmount()
  render(<Harness items={[]} />)
  open()
  expect(screen.getByText('Nothing here')).toBeInTheDocument()
})

test('a disabled select cannot open', () => {
  render(<Harness disabled />)
  open()
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
})

test('onOpenChange reports open and close', () => {
  const onOpenChange = jest.fn()
  render(<Harness value="A" onOpenChange={onOpenChange} />)
  open()
  act(() => { fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' }) })
  expect(onOpenChange.mock.calls.map((c) => c[0])).toEqual([true, false])
})

test('the list is marked as a select surface for dialog focus traps', () => {
  render(<Harness value="A" />)
  open()
  expect(screen.getByRole('listbox').closest('[data-cmx-select-root]')).not.toBeNull()
})
