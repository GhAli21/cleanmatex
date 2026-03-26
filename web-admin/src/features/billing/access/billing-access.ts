import type { PageAccessContract } from '@/lib/auth/access-contracts'

const BILLING_NOTES = [
  'No explicit page-level UI permission gate; route relies on navigation visibility and backend enforcement.',
]

export const BILLING_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/billing/invoices',
    label: 'Invoices',
    page: {},
    actions: {
      filterB2bInvoices: {
        label: 'Filter B2B invoices',
        requirement: {
          featureFlags: ['b2b_contracts'],
          requireAllFeatureFlags: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Filter B2B invoices',
        method: 'GET',
        path: '/api/v1/b2b-contracts?customer_id=[customerId]',
        requirement: {
          permissions: ['b2b_contracts:view'],
          requireAllPermissions: true,
        },
        notes: ['Used only when the B2B invoices filter is enabled on the screen.'],
      },
    ],
    notes: BILLING_NOTES,
  },
  {
    routePattern: '/dashboard/billing/invoices/[id]',
    label: 'Invoice Details',
    page: {},
    notes: BILLING_NOTES,
  },
  {
    routePattern: '/dashboard/billing/payments',
    label: 'Payments',
    page: {},
    actions: {
      cancelPayment: {
        label: 'Cancel payment',
        requirement: {
          permissions: ['payments:cancel'],
          requireAllPermissions: true,
        },
      },
      refundPayment: {
        label: 'Refund payment',
        requirement: {
          permissions: ['payments:refund'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Cancel payment',
        method: 'POST',
        path: 'app/actions/payments/payment-crud-actions.cancelPaymentAction',
        requirement: {
          permissions: ['payments:cancel'],
          requireAllPermissions: true,
        },
        notes: ['Server action used by the payments table row action.'],
      },
      {
        label: 'Refund payment',
        method: 'POST',
        path: 'app/actions/payments/payment-crud-actions.refundPaymentAction',
        requirement: {
          permissions: ['payments:refund'],
          requireAllPermissions: true,
        },
        notes: ['Server action used by the payments table row action.'],
      },
    ],
    notes: BILLING_NOTES,
  },
  {
    routePattern: '/dashboard/billing/payments/new',
    label: 'New Payment',
    page: {},
    notes: BILLING_NOTES,
  },
  {
    routePattern: '/dashboard/billing/payments/[id]',
    label: 'Payment Details',
    page: {},
    actions: {
      cancelPayment: {
        label: 'Cancel payment',
        requirement: {
          permissions: ['payments:cancel'],
          requireAllPermissions: true,
        },
      },
      refundPayment: {
        label: 'Refund payment',
        requirement: {
          permissions: ['payments:refund'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Cancel payment',
        method: 'POST',
        path: 'app/actions/payments/payment-crud-actions.cancelPaymentAction',
        requirement: {
          permissions: ['payments:cancel'],
          requireAllPermissions: true,
        },
        notes: ['Server action used by the payment details screen.'],
      },
      {
        label: 'Refund payment',
        method: 'POST',
        path: 'app/actions/payments/payment-crud-actions.refundPaymentAction',
        requirement: {
          permissions: ['payments:refund'],
          requireAllPermissions: true,
        },
        notes: ['Server action used by the payment details screen.'],
      },
    ],
    notes: BILLING_NOTES,
  },
  {
    routePattern: '/dashboard/billing/payments/[id]/print/receipt-voucher',
    label: 'Print Receipt Voucher',
    page: {},
    notes: BILLING_NOTES,
  },
  {
    routePattern: '/dashboard/billing/vouchers',
    label: 'Receipt Vouchers',
    page: {},
    notes: BILLING_NOTES,
  },
  {
    routePattern: '/dashboard/billing/vouchers/new',
    label: 'New Receipt Voucher',
    page: {},
    notes: BILLING_NOTES,
  },
  {
    routePattern: '/dashboard/billing/cashup',
    label: 'Cash Up',
    page: {},
    notes: BILLING_NOTES,
  },
]

export const BILLING_PAYMENTS_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/billing/payments')!

export const BILLING_PAYMENT_DETAIL_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/billing/payments/[id]')!

export const BILLING_INVOICES_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/billing/invoices')!
