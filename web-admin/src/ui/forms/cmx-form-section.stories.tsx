import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxInput } from '@ui/primitives';
import { CmxFormSection } from '@ui/forms'

import { CmxStatusBadge } from '@ui/feedback';
const meta = {
  title: 'Forms/CmxFormSection',
  component: CmxFormSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof CmxFormSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <CmxFormSection
      title="Branch setup"
      description="Keep branch-specific details grouped for faster onboarding."
      badge={<CmxStatusBadge size="sm" tone="info">Optional</CmxStatusBadge>}
      layout="twoColumn"
    >
      <CmxInput value="Muscat Central" onChange={() => undefined} />
      <CmxInput value="Main intake desk" onChange={() => undefined} />
    </CmxFormSection>
  ),
}

export const WithAside: Story = {
  render: () => (
    <CmxFormSection
      title="Pricing rules"
      description="These fields control the operator defaults used during intake."
      aside={<p className="text-sm text-slate-600">Changes take effect for new orders only.</p>}
      layout="autoFit"
      status="complete"
    >
      <CmxInput value="8.500" onChange={() => undefined} />
      <CmxInput value="12.000" onChange={() => undefined} />
      <CmxInput value="24" onChange={() => undefined} />
    </CmxFormSection>
  ),
}

export const RTL: Story = {
  render: () => (
    <CmxFormSection
      title="تفاصيل الفرع"
      description="رتّب الحقول ذات العلاقة في أقسام واضحة يسهل مراجعتها."
      layout="twoColumn"
      collapsible
    >
      <CmxInput value="فرع مسقط" onChange={() => undefined} />
      <CmxInput value="منطقة الاستقبال" onChange={() => undefined} />
    </CmxFormSection>
  ),
  parameters: {
    direction: 'rtl',
  },
}
