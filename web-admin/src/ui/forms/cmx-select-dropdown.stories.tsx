import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms'
import { CmxDialog, CmxDialogContent } from '@ui/overlays'

function SelectDropdownStory({
  rtl = false,
  isLoading = false,
}: {
  rtl?: boolean
  isLoading?: boolean
}) {
  const [value, setValue] = useState('wash')
  const options = rtl
    ? [
        { value: 'wash', label: 'غسيل وطي' },
        { value: 'dry', label: 'تنظيف جاف' },
        { value: 'press', label: 'كي فقط' },
      ]
    : [
        { value: 'wash', label: 'Wash & Fold' },
        { value: 'dry', label: 'Dry Clean' },
        { value: 'press', label: 'Press Only' },
      ]

  const selected = options.find((option) => option.value === value)

  return (
    <div className="w-[320px]" dir={rtl ? 'rtl' : 'ltr'}>
      <CmxSelectDropdown value={value} onValueChange={setValue} isLoading={isLoading}>
        <CmxSelectDropdownTrigger>
          <CmxSelectDropdownValue
            placeholder={rtl ? 'اختر الخدمة' : 'Select a service'}
            displayValue={selected?.label}
          />
        </CmxSelectDropdownTrigger>
        <CmxSelectDropdownContent>
          {options.map((option) => (
            <CmxSelectDropdownItem key={option.value} value={option.value}>
              {option.label}
            </CmxSelectDropdownItem>
          ))}
        </CmxSelectDropdownContent>
      </CmxSelectDropdown>
    </div>
  )
}

const meta = {
  title: 'Forms/CmxSelectDropdown',
  component: CmxSelectDropdown,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  render: () => <SelectDropdownStory />,
} satisfies Meta<typeof CmxSelectDropdown>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = {
  render: () => <SelectDropdownStory isLoading />,
}

export const Empty: Story = {
  render: () => (
    <div className="w-[320px]">
      <CmxSelectDropdown value="" onValueChange={() => {}}>
        <CmxSelectDropdownTrigger>
          <CmxSelectDropdownValue placeholder="Select a driver" />
        </CmxSelectDropdownTrigger>
        <CmxSelectDropdownContent>{null}</CmxSelectDropdownContent>
      </CmxSelectDropdown>
    </div>
  ),
}

/** Open it near the bottom of the window: the list flips upward and stays above the dialog. */
export const InDialogNearBottom: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <CmxDialog open onOpenChange={() => {}}>
      <CmxDialogContent>
        <div className="flex h-[70vh] flex-col justify-end gap-2 p-4">
          <p className="text-sm text-muted-foreground">Service</p>
          <SelectDropdownStory />
        </div>
      </CmxDialogContent>
    </CmxDialog>
  ),
}

export const RTL: Story = {
  render: () => <SelectDropdownStory rtl />,
  parameters: {
    direction: 'rtl',
  },
}
