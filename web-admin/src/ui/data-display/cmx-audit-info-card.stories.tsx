/**
 * Storybook coverage for the reusable audit metadata card.
 *
 * Exercises explicit props, raw-record adoption, collapsed extras, and RTL
 * layout so detail screens can reuse the component confidently.
 */

import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxAuditInfoCard } from '@ui/data-display'

const meta = {
  title: 'DataDisplay/CmxAuditInfoCard',
  component: CmxAuditInfoCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof CmxAuditInfoCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    createdAt: '2026-06-18T10:30:00.000Z',
    createdBy: {
      displayName: 'Aisha Rahman',
      email: 'aisha@cleanmatex.test',
    },
    updatedAt: '2026-06-18T13:15:00.000Z',
    updatedBy: 'ops_user_001',
  },
}

export const RawRecord: Story = {
  args: {
    record: {
      created_at: '2026-06-17T09:00:00.000Z',
      created_by: {
        display_name: 'Salim Al-Harthi',
        email: 'salim@cleanmatex.test',
      },
      updated_at: '2026-06-18T08:45:00.000Z',
      updated_by: 'user_48291',
      rec_status: 'ACTIVE',
      rec_order: 12,
      rec_notes: 'Imported from branch setup sync.',
    },
  },
}

export const ExtrasCollapsed: Story = {
  args: {
    createdAt: '2026-06-15T07:00:00.000Z',
    createdBy: 'batch_job_001',
    updatedAt: '2026-06-18T11:20:00.000Z',
    updatedBy: {
      email: 'finance.manager@cleanmatex.test',
    },
    extras: [
      { key: 'postedAt', label: 'Posted at', value: new Date('2026-06-18T11:30:00.000Z') },
      { key: 'postedBy', label: 'Posted by', value: 'Finance Manager' },
      { key: 'reversalReason', label: 'Reversal reason', value: 'Manual adjustment hold', hideWhenEmpty: true },
    ],
  },
}

export const ExtrasExpanded: Story = {
  args: {
    createdAt: '2026-06-15T07:00:00.000Z',
    createdBy: 'batch_job_001',
    updatedAt: '2026-06-18T11:20:00.000Z',
    updatedBy: {
      email: 'finance.manager@cleanmatex.test',
    },
    defaultExpanded: true,
    extras: [
      { key: 'postedAt', label: 'Posted at', value: new Date('2026-06-18T11:30:00.000Z') },
      { key: 'postedBy', label: 'Posted by', value: 'Finance Manager' },
      { key: 'reversalReason', label: 'Reversal reason', value: 'Manual adjustment hold', hideWhenEmpty: true },
    ],
  },
}

export const ActorFallback: Story = {
  args: {
    createdAt: '2026-06-16T08:00:00.000Z',
    createdBy: {
      label: 'Branch Manager',
      displayName: 'Will Not Be Shown',
      email: 'branch.manager@cleanmatex.test',
      id: 'user_999',
    },
    updatedAt: '2026-06-16T12:00:00.000Z',
    updatedBy: {
      email: 'ops.supervisor@cleanmatex.test',
    },
  },
}

export const SparseRecord: Story = {
  args: {
    record: {
      created_at: '2026-06-18T06:25:00.000Z',
    },
  },
}

export const RTL: Story = {
  args: {
    title: 'معلومات التدقيق',
    createdAt: '2026-06-18T10:30:00.000Z',
    createdBy: {
      displayName: 'فريق التشغيل',
    },
    updatedAt: '2026-06-18T13:15:00.000Z',
    updatedBy: 'user_ar_001',
    extras: [
      { key: 'recNotes', label: 'ملاحظات السجل', value: 'تم تحديث البيانات من شاشة الإدارة.' },
    ],
  },
  parameters: {
    direction: 'rtl',
  },
  // RTL variant — verifies Arabic layout direction.
}
