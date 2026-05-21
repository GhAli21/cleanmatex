import type { Meta, StoryObj } from '@storybook/nextjs'
import { useForm } from 'react-hook-form'
import { CmxFormField } from '@ui/forms'
import { CmxInput } from '@ui/primitives'

function FieldStory({
  layout = 'stacked',
  error = '',
  rtl = false,
}: {
  layout?: 'stacked' | 'inline' | 'compact'
  error?: string
  rtl?: boolean
}) {
  const form = useForm<{ value: string }>({
    defaultValues: { value: 'Wash & Fold' },
    mode: 'onChange',
  })

  if (error) {
    form.setError('value', { type: 'manual', message: error })
  }

  return (
    <div className="w-[420px]" dir={rtl ? 'rtl' : 'ltr'}>
      <form>
        <CmxFormField
          name="value"
          label={rtl ? 'اسم الخدمة' : 'Service name'}
          description={rtl ? 'يظهر هذا الاسم في شاشة الاستقبال.' : 'Shown in intake and preparation screens.'}
          hint={rtl ? 'استخدم اسماً واضحاً للفريق والعميل.' : 'Use a label that is clear for staff and customers.'}
          layout={layout}
        >
          {({ id, describedBy, invalid, ...field }) => (
            <CmxInput
              {...field}
              id={id}
              value={String(field.value ?? '')}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </CmxFormField>
      </form>
    </div>
  )
}

const meta = {
  title: 'Forms/CmxFormField',
  component: CmxFormField,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  render: () => <FieldStory />,
} satisfies Meta<typeof CmxFormField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Inline: Story = {
  render: () => <FieldStory layout="inline" />,
}

export const WithError: Story = {
  render: () => <FieldStory error="Please choose a service name." />,
}

export const RTL: Story = {
  render: () => <FieldStory rtl />,
  parameters: {
    direction: 'rtl',
  },
}
