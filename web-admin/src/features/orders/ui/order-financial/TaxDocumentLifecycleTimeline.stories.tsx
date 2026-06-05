import type { Meta, StoryObj } from '@storybook/nextjs'
import { TaxDocumentLifecycleTimeline } from './tax-document-lifecycle-timeline'

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Features/Orders/Financial/TaxDocumentLifecycleTimeline',
  component: TaxDocumentLifecycleTimeline,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    currencyCode: { control: 'text' },
  },
  args: {
    currencyCode: 'OMR',
  },
} satisfies Meta<typeof TaxDocumentLifecycleTimeline>

export default meta
type Story = StoryObj<typeof meta>

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Draft: Story = {
  args: {
    taxDocument: {
      id: 'doc-001',
      documentType: 'INVOICE',
      status: 'DRAFT',
      triggerEvent: 'ON_ORDER_SUBMIT',
      fiscalYear: 2026,
      sequenceNumber: 42,
      documentNo: undefined,
      totalAmount: 105.0,
      taxAmount: 5.0,
    },
  },
}

export const Issued: Story = {
  args: {
    taxDocument: {
      id: 'doc-002',
      documentType: 'INVOICE',
      documentNo: 'INV-2026-000042',
      status: 'ISSUED',
      triggerEvent: 'ON_PAYMENT_CONFIRMATION',
      fiscalYear: 2026,
      sequenceNumber: 42,
      totalAmount: 105.0,
      taxAmount: 5.0,
      issuedAt: '2026-06-05T10:30:00.000Z',
      issuedBy: 'system',
    },
  },
}

export const Cancelled: Story = {
  args: {
    taxDocument: {
      id: 'doc-003',
      documentType: 'SIMPLIFIED_INVOICE',
      documentNo: 'SINV-2026-000010',
      status: 'CANCELLED',
      triggerEvent: 'ON_ORDER_SUBMIT',
      fiscalYear: 2026,
      sequenceNumber: 10,
      totalAmount: 52.5,
      taxAmount: 2.5,
      issuedAt: '2026-06-01T09:00:00.000Z',
      cancelledAt: '2026-06-03T14:00:00.000Z',
      cancellationReason: 'Customer requested cancellation',
    },
  },
}

export const CreditNote: Story = {
  args: {
    taxDocument: {
      id: 'doc-004',
      documentType: 'CREDIT_NOTE',
      documentNo: 'CN-2026-000003',
      status: 'ISSUED',
      triggerEvent: 'ON_ORDER_SUBMIT',
      fiscalYear: 2026,
      sequenceNumber: 3,
      totalAmount: -105.0,
      taxAmount: -5.0,
      supersedesId: 'doc-002',
      issuedAt: '2026-06-05T14:00:00.000Z',
    },
  },
}

export const LegacyMinimal: Story = {
  name: 'Legacy (no lifecycle fields)',
  args: {
    taxDocument: {
      id: 'doc-legacy',
      documentNo: 'TAX-20260501-001',
      documentType: 'INVOICE',
      status: 'ISSUED',
    },
  },
}

export const RTL: Story = {
  name: 'RTL (Arabic)',
  args: {
    taxDocument: {
      id: 'doc-ar-001',
      documentType: 'INVOICE',
      documentNo: 'INV-2026-000099',
      status: 'ISSUED',
      triggerEvent: 'ON_PAYMENT_CONFIRMATION',
      fiscalYear: 2026,
      sequenceNumber: 99,
      totalAmount: 210.0,
      taxAmount: 10.0,
      issuedAt: '2026-06-05T08:00:00.000Z',
    },
    currencyCode: 'SAR',
  },
  parameters: {
    direction: 'rtl',
  },
}
