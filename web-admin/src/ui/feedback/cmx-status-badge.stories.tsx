import type { Meta, StoryObj } from '@storybook/nextjs'
import { CheckCircle2, Clock } from 'lucide-react'
import { CmxStatusBadge, type CmxBadgeTone } from '@ui/feedback'

const TONES: CmxBadgeTone[] = ['neutral', 'info', 'success', 'warning', 'danger', 'brand']

const meta = {
  title: 'Feedback/CmxStatusBadge',
  component: CmxStatusBadge,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { label: 'Ready', tone: 'success' },
} satisfies Meta<typeof CmxStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const TonesAndAppearances: Story = {
  render: () => (
    <div className="grid gap-3 rounded-lg bg-card p-6">
      {(['soft', 'outline', 'solid'] as const).map((appearance) => (
        <div key={appearance} className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs text-muted-foreground">{appearance}</span>
          {TONES.map((tone) => (
            <CmxStatusBadge key={tone} tone={tone} appearance={appearance} label={tone} />
          ))}
        </div>
      ))}
    </div>
  ),
}

export const WithIconAndSizes: Story = {
  render: () => (
    <div className="flex items-center gap-2 rounded-lg bg-card p-6">
      <CmxStatusBadge size="sm" tone="info" icon={Clock} label="Processing" />
      <CmxStatusBadge size="md" tone="success" icon={CheckCircle2} label="Ready" />
      <CmxStatusBadge size="lg" tone="warning" icon={Clock} label="Pending payment" />
    </div>
  ),
}

export const RTL: Story = {
  args: { label: 'جاهز للتسليم', icon: CheckCircle2 },
  parameters: { direction: 'rtl' },
}
