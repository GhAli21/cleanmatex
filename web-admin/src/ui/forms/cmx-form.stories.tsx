import type { Meta, StoryObj } from '@storybook/nextjs'
import { useForm } from 'react-hook-form'
import { CmxForm, CmxFormActions, CmxFormField, CmxFormSection } from '@ui/forms'
import { CmxInput } from '@ui/primitives'

function FormStory({
  rtl = false,
  triggerError = false,
}: {
  rtl?: boolean
  triggerError?: boolean
}) {
  const form = useForm<{ serviceName: string; turnaround: string }>({
    defaultValues: {
      serviceName: triggerError ? '' : 'Wash & Fold',
      turnaround: '24',
    },
  })

  return (
    <div className="w-[720px]" dir={rtl ? 'rtl' : 'ltr'}>
      <CmxForm
        form={form}
        onSubmit={() => undefined}
        showErrorSummary={triggerError}
        errorSummaryTitle={rtl ? 'راجع الحقول أدناه' : 'Review the highlighted fields'}
        className="space-y-4"
      >
        <CmxFormSection
          title={rtl ? 'إعدادات الخدمة' : 'Service setup'}
          description={rtl ? 'مثال سريع على استخدام النموذج.' : 'A compact example of the form shell in action.'}
          layout="twoColumn"
        >
          <CmxFormField
            name="serviceName"
            label={rtl ? 'اسم الخدمة' : 'Service name'}
            required
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

          <CmxFormField
            name="turnaround"
            label={rtl ? 'المدة' : 'Turnaround hours'}
            required
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
        </CmxFormSection>

        <CmxFormActions primaryLabel={rtl ? 'حفظ' : 'Save'} secondaryLabel={rtl ? 'إلغاء' : 'Cancel'} />
      </CmxForm>
    </div>
  )
}

const meta = {
  title: 'Forms/CmxForm',
  component: CmxForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  render: () => <FormStory />,
} satisfies Meta<typeof CmxForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithValidation: Story = {
  render: () => <FormStory triggerError />,
}

export const RTL: Story = {
  render: () => <FormStory rtl />,
  parameters: {
    direction: 'rtl',
  },
}
