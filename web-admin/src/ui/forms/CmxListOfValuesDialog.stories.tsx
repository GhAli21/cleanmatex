import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxListOfValuesDialog } from '@ui/forms'

type LookupOption = {
  id: string
  label: string
  description: string
}

const options: readonly LookupOption[] = [
  { id: 'operator-amal', label: 'Amal Al-Harthi', description: 'Main Branch' },
  { id: 'operator-khalid', label: 'Khalid Al-Balushi', description: 'Airport Branch' },
  { id: 'operator-sara', label: 'Sara Al-Rawahi', description: 'Qurum Branch' },
]

const labels = {
  title: 'Select operator',
  searchLabel: 'Search operators',
  searchPlaceholder: 'Search by name or branch',
  loadingLabel: 'Loading operators',
  emptyLabel: 'No operators match your search.',
  clearLabel: 'Clear selection',
  cancelLabel: 'Cancel',
  applyLabel: 'Apply selection',
  optionsLabel: 'Available operators',
}

function ListOfValuesDialogStory({
  initialSelectedId = 'operator-amal',
  isLoading = false,
  storyOptions = options,
  rtl = false,
}: {
  initialSelectedId?: string | null
  isLoading?: boolean
  storyOptions?: readonly LookupOption[]
  rtl?: boolean
}) {
  const [open, setOpen] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId)

  return (
    <div dir={rtl ? 'rtl' : 'ltr'}>
      <CmxListOfValuesDialog
        open={open}
        onOpenChange={setOpen}
        options={storyOptions}
        selectedId={selectedId}
        onApply={setSelectedId}
        getOptionId={(option) => option.id}
        getOptionLabel={(option) => option.label}
        getOptionDescription={(option) => option.description}
        isLoading={isLoading}
        labels={rtl ? {
          title: 'اختيار الموظف',
          searchLabel: 'البحث عن الموظفين',
          searchPlaceholder: 'ابحث بالاسم أو الفرع',
          loadingLabel: 'جارٍ تحميل الموظفين',
          emptyLabel: 'لا يوجد موظفون يطابقون البحث.',
          clearLabel: 'مسح الاختيار',
          cancelLabel: 'إلغاء',
          applyLabel: 'تطبيق الاختيار',
          optionsLabel: 'الموظفون المتاحون',
        } : labels}
      />
    </div>
  )
}

const meta = {
  title: 'Forms/CmxListOfValuesDialog',
  component: CmxListOfValuesDialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    open: { control: 'boolean', description: 'Whether the dialog is visible.' },
    selectedId: { control: 'text', description: 'The value applied before opening the dialog.' },
    isLoading: { control: 'boolean', description: 'Shows the non-interactive loading state.' },
    getOptionId: { control: false },
    getOptionLabel: { control: false },
    getOptionDescription: { control: false },
    isOptionDisabled: { control: false },
    renderOption: { control: false },
    onOpenChange: { control: false },
    onApply: { control: false },
    labels: { control: false },
    options: { control: false },
  },
  render: () => <ListOfValuesDialogStory />,
} satisfies Meta<typeof CmxListOfValuesDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = {
  render: () => <ListOfValuesDialogStory isLoading />,
}

export const Empty: Story = {
  render: () => <ListOfValuesDialogStory initialSelectedId={null} storyOptions={[]} />,
}

export const SelectionAndClear: Story = {
  name: 'Selection and clear',
  render: () => <ListOfValuesDialogStory initialSelectedId="operator-khalid" />,
}

export const RTL: Story = {
  name: 'RTL (Arabic)',
  render: () => <ListOfValuesDialogStory rtl />,
  parameters: {
    direction: 'rtl',
  },
}
