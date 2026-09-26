import type { PageAccessContract } from '@/lib/auth/access-contracts'

const CUSTOMERS_NOTES = [
  'No explicit UI permission gate; route relies on shell context, navigation visibility, or backend enforcement.',
]

export const CUSTOMERS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/customers',
    label: 'Customers',
    page: {},
    actions: {
      useB2bCustomerOptions: {
        label: 'Use B2B customer options',
        requirement: {
          featureFlags: ['b2b_contracts'],
          requireAllFeatureFlags: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'List customers',
        method: 'GET',
        path: '/api/v1/customers',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Customer statistics',
        method: 'GET',
        path: '/api/v1/customers?includeStats=true',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create customer',
        method: 'POST',
        path: '/api/v1/customers',
        requirement: {
          permissions: ['customers:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Export customers',
        method: 'GET',
        path: '/api/v1/customers/export',
        notes: ['Auth-only export route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: CUSTOMERS_NOTES,
  },
  {
    routePattern: '/dashboard/customers/account-receipt',
    label: 'Customer Account Receipt',
    page: {
      permissions: ['customers:receipt_allocate'],
      requireAllPermissions: true,
    },
    notes: [
      'Standalone customer account receipt allocation screen.',
      'CLF W6: the tender step reuses StoredValueTenderFields (useCashDrawer), so cash receipts pick / open a drawer session; the cash-drawer ledger gate decides the drawer on post.',
    ],
    apiDependencies: [
      {
        label: 'List cash drawers and open sessions (tender step)',
        method: 'GET',
        path: '/api/v1/cash-drawers',
        requirement: {
          permissions: ['cash_drawer:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Open a cash-drawer session (tender step)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/open-session',
        requirement: {
          permissions: ['cash_drawer:open_session'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Eligible payment methods',
        method: 'GET',
        path: '/api/v1/orders/checkout-options',
        notes: ['Auth-only route; lists REAL_PAYMENT methods allowed in POS.'],
      },
      {
        label: 'Customer open balances (manual allocation)',
        method: 'GET',
        path: '/api/v1/customers/[id]/open-balances',
        requirement: {
          permissions: ['orders:overpayment_allocate'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Preview auto allocation',
        method: 'POST',
        path: '/api/v1/customer-receipts/allocation/preview-auto',
        requirement: {
          permissions: ['customers:receipt_allocate', 'orders:overpayment_allocate'],
          requireAllPermissions: false,
        },
      },
      {
        label: 'Preview manual allocation',
        method: 'POST',
        path: '/api/v1/customer-receipts/allocation/preview-manual',
        requirement: {
          permissions: ['customers:receipt_allocate', 'orders:overpayment_allocate'],
          requireAllPermissions: false,
        },
      },
      {
        label: 'Confirm allocation preview',
        method: 'POST',
        path: '/api/v1/customer-receipts/allocation/post',
        requirement: {
          permissions: ['customers:receipt_allocate', 'orders:overpayment_allocate'],
          requireAllPermissions: false,
        },
      },
      {
        label: 'Post customer account receipt',
        method: 'POST',
        path: '/api/v1/customer-receipts/post',
        requirement: {
          permissions: ['customers:receipt_allocate', 'orders:overpayment_allocate'],
          requireAllPermissions: false,
        },
        notes: ['CSRF-validated. Cash-drawer ledger refusals and receipt business errors return HTTP 422 with a stable `code`.'],
      },
    ],
  },
  {
    routePattern: '/dashboard/customers/stored-value',
    label: 'Stored Value',
    page: {
      permissions: ['stored_value:view_balances'],
      requireAllPermissions: true,
    },
    notes: ['Stored value balances route requires the dedicated stored value viewer permission from navigation.'],
  },
  {
    routePattern: '/dashboard/customers/[id]',
    label: 'Customer Details',
    page: {},
    actions: {
      topUpWallet: {
        label: 'Top up customer wallet (stored-value tab)',
        requirement: {
          permissions: ['stored_value:issue_wallet_credit'],
          requireAllPermissions: true,
        },
      },
      issueAdvance: {
        label: 'Issue customer advance (stored-value tab)',
        requirement: {
          permissions: ['stored_value:issue_advance'],
          requireAllPermissions: true,
        },
      },
      issueCreditNote: {
        label: 'Issue customer credit note (stored-value tab)',
        requirement: {
          permissions: ['stored_value:issue_credit_note'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Get customer details',
        method: 'GET',
        path: '/api/v1/customers/[id]',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Customer preferences',
        method: 'GET',
        path: '/api/v1/customers/[id]/service-prefs',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update customer preferences',
        method: 'POST',
        path: '/api/v1/customers/[id]/service-prefs',
        requirement: {
          permissions: ['customers:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Catalog service preferences',
        method: 'GET',
        path: '/api/v1/catalog/service-preferences',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List customer B2B contacts',
        method: 'GET',
        path: '/api/v1/b2b-contacts?customer_id=[id]',
        requirement: {
          permissions: ['b2b_contacts:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List customer B2B contracts',
        method: 'GET',
        path: '/api/v1/b2b-contracts?customer_id=[id]',
        requirement: {
          permissions: ['b2b_contracts:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List customer B2B statements',
        method: 'GET',
        path: '/api/v1/b2b-statements?customer_id=[id]',
        requirement: {
          permissions: ['b2b_statements:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Customer loyalty account, transactions, and expiry summary (Loyalty tab)',
        method: 'GET',
        path: '/api/v1/customers/[id]/loyalty',
        requirement: {
          permissions: ['loyalty:view_customer_points'],
          requireAllPermissions: true,
        },
        notes: ['B19 follow-up (2026-09-17) — corrected from the previously-unseeded loyalty:view code; wires this route into the Loyalty tab for the first time.'],
      },
    ],
    notes: CUSTOMERS_NOTES,
  },
]

export const CUSTOMERS_CUSTOMERS_ACCESS = CUSTOMERS_ACCESS_CONTRACTS[0]!
export const CUSTOMERS_CUSTOMERS_ACCOUNT_RECEIPT_ACCESS = CUSTOMERS_ACCESS_CONTRACTS[1]!
export const CUSTOMERS_CUSTOMERS_STORED_VALUE_ACCESS = CUSTOMERS_ACCESS_CONTRACTS[2]!
export const CUSTOMERS_CUSTOMERS_ID_ACCESS = CUSTOMERS_ACCESS_CONTRACTS[3]!
