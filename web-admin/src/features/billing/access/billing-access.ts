import type { PageAccessContract } from '@/lib/auth/access-contracts'

const BILLING_NOTES = [
  'No explicit page-level UI permission gate; route relies on navigation visibility and backend enforcement.',
]

export const BILLING_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/internal_fin',
    label: 'Internal Finance And Operations',
    page: {},
    notes: ['Section hub route; redirects to invoices list.'],
  },
  {
    routePattern: '/dashboard/internal_fin/invoices',
    label: 'Invoices',
    page: {
      permissions: ['invoices:read'],
      requireAllPermissions: true,
    },
    actions: {
      createManualInvoice: {
        label: 'Create manual AR invoice',
        requirement: {
          permissions: ['invoices:create'],
          requireAllPermissions: true,
        },
      },
      exportInvoices: {
        label: 'Export AR invoices',
        requirement: {
          permissions: ['invoices:export'],
          requireAllPermissions: true,
        },
      },
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
        label: 'List AR invoices',
        method: 'GET',
        path: '/api/v1/ar/invoices',
        requirement: {
          permissions: ['invoices:read'],
          requireAllPermissions: true,
        },
      },
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
      {
        label: 'Create manual AR invoice',
        method: 'POST',
        path: '/api/v1/ar/invoices',
        requirement: {
          permissions: ['invoices:create'],
          requireAllPermissions: true,
        },
        notes: ['Used by the new manual AR invoice wizard.'],
      },
      {
        label: 'Export AR invoices',
        method: 'GET',
        path: '/api/v1/ar/invoices/export',
        requirement: {
          permissions: ['invoices:export'],
          requireAllPermissions: true,
        },
        notes: ['Used by the canonical AR invoice hub export control.'],
      },
    ],
    notes: ['Sidebar navigation also requires `invoices:read`.', ...BILLING_NOTES],
  },
  {
    routePattern: '/dashboard/internal_fin/invoices/new',
    label: 'New AR Invoice',
    page: {
      permissions: ['invoices:create'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Create AR invoice',
        method: 'POST',
        path: '/api/v1/ar/invoices',
        requirement: {
          permissions: ['invoices:create'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['Wizard page for manual AR invoice creation.'],
  },
  {
    routePattern: '/dashboard/internal_fin/invoices/[id]',
    label: 'Invoice Details',
    page: {
      permissions: ['invoices:read'],
      requireAllPermissions: true,
    },
    actions: {
      editSummary: {
        label: 'Edit invoice summary',
        requirement: {
          permissions: ['invoices:update'],
          requireAllPermissions: true,
        },
      },
      issueInvoice: {
        label: 'Issue AR invoice',
        requirement: {
          permissions: ['invoices:issue'],
          requireAllPermissions: true,
        },
      },
      approveSensitiveAction: {
        label: 'Approve sensitive AR action',
        requirement: {
          permissions: ['invoices:approve_sensitive'],
          requireAllPermissions: true,
        },
      },
      allocatePayment: {
        label: 'Allocate or reverse invoice payment',
        requirement: {
          permissions: ['invoices:allocate_payment'],
          requireAllPermissions: true,
        },
      },
      createCreditNote: {
        label: 'Create AR credit memo',
        requirement: {
          permissions: ['invoices:credit_note'],
          requireAllPermissions: true,
        },
      },
      createDebitNote: {
        label: 'Create AR debit note',
        requirement: {
          permissions: ['invoices:debit_note'],
          requireAllPermissions: true,
        },
      },
      writeOffInvoice: {
        label: 'Write off AR invoice',
        requirement: {
          permissions: ['invoices:write_off'],
          requireAllPermissions: true,
        },
      },
      voidInvoice: {
        label: 'Void AR invoice',
        requirement: {
          permissions: ['invoices:void'],
          requireAllPermissions: true,
        },
      },
      printInvoice: {
        label: 'Print AR invoice',
        requirement: {
          permissions: ['invoices:print'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Get AR invoice detail',
        method: 'GET',
        path: '/api/v1/ar/invoices/[id]',
        requirement: {
          permissions: ['invoices:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update AR invoice summary',
        method: 'PATCH',
        path: '/api/v1/ar/invoices/[id]',
        requirement: {
          permissions: ['invoices:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Issue AR invoice',
        method: 'POST',
        path: '/api/v1/ar/invoices/[id]/issue',
        requirement: {
          permissions: ['invoices:issue'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Approve sensitive AR action',
        method: 'POST',
        path: '/api/v1/ar/invoices/[id]/approve-sensitive',
        requirement: {
          permissions: ['invoices:approve_sensitive'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Allocate AR payment',
        method: 'POST',
        path: '/api/v1/ar/invoices/[id]/allocations',
        requirement: {
          permissions: ['invoices:allocate_payment'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Reverse AR payment allocation',
        method: 'POST',
        path: '/api/v1/ar/invoices/[id]/allocations/[allocationId]/reverse',
        requirement: {
          permissions: ['invoices:allocate_payment'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create AR credit memo',
        method: 'POST',
        path: '/api/v1/ar/invoices/[id]/credit-note',
        requirement: {
          permissions: ['invoices:credit_note'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create AR debit note',
        method: 'POST',
        path: '/api/v1/ar/invoices/[id]/debit-note',
        requirement: {
          permissions: ['invoices:debit_note'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create AR write-off',
        method: 'POST',
        path: '/api/v1/ar/invoices/[id]/write-off',
        requirement: {
          permissions: ['invoices:write_off'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Void AR invoice',
        method: 'POST',
        path: '/api/v1/ar/invoices/[id]/void',
        requirement: {
          permissions: ['invoices:void'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Print AR invoice',
        method: 'GET',
        path: '/api/v1/ar/invoices/[id]/print',
        requirement: {
          permissions: ['invoices:print'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['Details surface ledger, allocations, and adjustment audit tabs.', ...BILLING_NOTES],
  },
  {
    routePattern: '/dashboard/internal_fin/invoices/[id]/print',
    label: 'Print AR Invoice',
    page: {
      permissions: ['invoices:print'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Print AR invoice',
        method: 'GET',
        path: '/api/v1/ar/invoices/[id]/print',
        requirement: {
          permissions: ['invoices:print'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['Printable AR invoice report route.'],
  },
  {
    routePattern: '/dashboard/internal_fin/ar/aging',
    label: 'AR Aging',
    page: {
      permissions: ['ar_aging:view'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'AR aging report',
        method: 'GET',
        path: '/api/v1/ar/reports/aging',
        requirement: {
          permissions: ['ar_aging:view'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['Reuses the shared AR aging logic for internal finance dashboards.'],
  },
  {
    routePattern: '/dashboard/internal_fin/ar/customers',
    label: 'AR Customers',
    page: {
      permissions: ['ar_ledger:view'],
      requireAllPermissions: true,
    },
    notes: ['Customer balance hub built from tenant-scoped AR service projections.'],
  },
  {
    routePattern: '/dashboard/internal_fin/ar/ledger',
    label: 'AR Ledger',
    page: {
      permissions: ['ar_ledger:view'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Customer AR balance',
        method: 'GET',
        path: '/api/v1/ar/customers/[customerId]/balance',
        requirement: {
          permissions: ['ar_ledger:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Customer AR ledger',
        method: 'GET',
        path: '/api/v1/ar/customers/[customerId]/ledger',
        requirement: {
          permissions: ['ar_ledger:view'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['Requires a selected customer to resolve tenant-safe ledger facts.'],
  },
  {
    routePattern: '/dashboard/internal_fin/ar/statements',
    label: 'Customer Statements',
    page: {
      permissions: ['customer_statements:view'],
      requireAllPermissions: true,
    },
    actions: {
      printStatement: {
        label: 'Print customer statement',
        requirement: {
          permissions: ['customer_statements:view'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Customer AR statement',
        method: 'GET',
        path: '/api/v1/ar/customers/[customerId]/statements',
        requirement: {
          permissions: ['customer_statements:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Print customer statement',
        method: 'GET',
        path: '/api/v1/ar/customers/[customerId]/statements/print',
        requirement: {
          permissions: ['customer_statements:view'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['Statement view requires a selected customer and statement period filters.'],
  },
  {
    routePattern: '/dashboard/internal_fin/ar/statements/print',
    label: 'Print Customer Statement',
    page: {
      permissions: ['customer_statements:view'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Print customer statement',
        method: 'GET',
        path: '/api/v1/ar/customers/[customerId]/statements/print',
        requirement: {
          permissions: ['customer_statements:view'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['Printable customer statement route.'],
  },
  {
    routePattern: '/dashboard/internal_fin/ar/credits',
    label: 'AR Credits',
    page: {
      permissions: ['ar_credits:view'],
      requireAllPermissions: true,
    },
    actions: {
      applyCredit: {
        label: 'Apply AR credit',
        requirement: {
          permissions: ['ar_credits:apply'],
          requireAllPermissions: true,
        },
      },
      reverseCreditApplication: {
        label: 'Reverse AR credit application',
        requirement: {
          permissions: ['ar_credits:reverse'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'List AR credits',
        method: 'GET',
        path: '/api/v1/ar/credits',
        requirement: {
          permissions: ['ar_credits:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Apply AR credit',
        method: 'POST',
        path: '/api/v1/ar/credits/applications',
        requirement: {
          permissions: ['ar_credits:apply'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Reverse AR credit application',
        method: 'POST',
        path: '/api/v1/ar/credits/applications/[id]/reverse',
        requirement: {
          permissions: ['ar_credits:reverse'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['Credit operations reuse unapplied AR ledger credit as the canonical source.'],
  },
  {
    routePattern: '/dashboard/internal_fin/ar/disputes',
    label: 'AR Disputes',
    page: {
      permissions: ['ar_disputes:view'],
      requireAllPermissions: true,
    },
    actions: {
      createDispute: {
        label: 'Create AR dispute',
        requirement: {
          permissions: ['ar_disputes:create'],
          requireAllPermissions: true,
        },
      },
      resolveDispute: {
        label: 'Resolve AR dispute',
        requirement: {
          permissions: ['ar_disputes:resolve'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'List AR disputes',
        method: 'GET',
        path: '/api/v1/ar/disputes',
        requirement: {
          permissions: ['ar_disputes:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create AR dispute',
        method: 'POST',
        path: '/api/v1/ar/disputes',
        requirement: {
          permissions: ['ar_disputes:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Resolve AR dispute',
        method: 'POST',
        path: '/api/v1/ar/disputes/[id]/resolve',
        requirement: {
          permissions: ['ar_disputes:resolve'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['Dispute workflows place invoices into `DISPUTED` status until resolution completes.'],
  },
  {
    routePattern: '/dashboard/internal_fin/ar/dunning',
    label: 'AR Dunning',
    page: {
      permissions: ['ar_dunning:view'],
      requireAllPermissions: true,
    },
    actions: {
      runDunningAction: {
        label: 'Run AR dunning action',
        requirement: {
          permissions: ['ar_dunning:run'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'List AR dunning runs',
        method: 'GET',
        path: '/api/v1/ar/dunning',
        requirement: {
          permissions: ['ar_dunning:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Run AR dunning action',
        method: 'POST',
        path: '/api/v1/ar/dunning/run',
        requirement: {
          permissions: ['ar_dunning:run'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['Dunning actions log the communication or hold step without bypassing tenant-safe AR controls.'],
  },
  {
    routePattern: '/dashboard/internal_fin/ar/cycles',
    label: 'AR Statement Cycles',
    page: {
      permissions: ['ar_stmt_cycles:view'],
      requireAllPermissions: true,
    },
    actions: {
      createStatementCycle: {
        label: 'Create AR statement cycle',
        requirement: {
          permissions: ['ar_stmt_cycles:manage'],
          requireAllPermissions: true,
        },
      },
      previewStatementCycle: {
        label: 'Preview AR statement cycle',
        requirement: {
          permissions: ['ar_stmt_cycles:view'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'List AR statement cycles',
        method: 'GET',
        path: '/api/v1/ar/statement-cycles',
        requirement: {
          permissions: ['ar_stmt_cycles:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create AR statement cycle',
        method: 'POST',
        path: '/api/v1/ar/statement-cycles',
        requirement: {
          permissions: ['ar_stmt_cycles:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Preview AR statement cycle',
        method: 'GET',
        path: '/api/v1/ar/statement-cycles/[id]/preview',
        requirement: {
          permissions: ['ar_stmt_cycles:view'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['Statement cycles define which B2B receivables roll into consolidated billing runs.'],
  },
  // NOTE: /dashboard/internal_fin/payments* contracts were removed with the
  // screens themselves (Order-Fin remediation Phase 3) — they operated on the
  // legacy payments ledger (dropped by migration 0395) (ADR-002). Canonical money entry:
  // order checkout / collect-payment, AR invoice payments, customer receipts.
  {
    routePattern: '/dashboard/internal_fin/cash-drawers',
    label: 'Cash Drawers',
    page: {
      permissions: ['cash_drawer:view'],
      requireAllPermissions: true,
    },
    notes: ['Cash drawer operations route with explicit page gate from navigation.'],
  },
  {
    routePattern: '/dashboard/internal_fin/cash-drawers/[drawerId]',
    label: 'Cash Drawer Details',
    page: {
      permissions: ['cash_drawer:view'],
      requireAllPermissions: true,
    },
    notes: ['Cash drawer detail route inherits the same page gate as the list view.'],
  },
  {
    routePattern: '/dashboard/internal_fin/cash-drawers/[drawerId]/session/[sessionId]',
    label: 'Cash Drawer Session Details',
    page: {
      permissions: ['cash_drawer:view'],
      requireAllPermissions: true,
    },
    notes: ['Hidden session truth route used for detailed cash reconciliation and audit review.'],
  },
  {
    routePattern: '/dashboard/internal_fin/cash-drawers/[drawerId]/session/[sessionId]/print',
    label: 'Print Cash Drawer Session',
    page: {
      permissions: ['cash_drawer:view'],
      requireAllPermissions: true,
    },
    notes: ['Printable cash drawer session summary route.'],
  },
  {
    routePattern: '/dashboard/internal_fin/reconciliation',
    label: 'Finance Reconciliation',
    page: {
      permissions: ['reconciliation:view'],
      requireAllPermissions: true,
    },
    notes: ['Finance reconciliation run list route with explicit page gate from navigation.'],
  },
  {
    routePattern: '/dashboard/internal_fin/reconciliation/[runId]',
    label: 'Finance Reconciliation Details',
    page: {
      permissions: ['reconciliation:view'],
      requireAllPermissions: true,
    },
    notes: ['Finance reconciliation run detail route.'],
  },
  {
    routePattern: '/dashboard/internal_fin/refunds',
    label: 'Refunds',
    page: {
      permissions: ['orders:process_refund'],
      requireAllPermissions: true,
    },
    notes: ['Refund workbench route using the same page gate exposed in navigation.'],
  },
  // '/dashboard/internal_fin/cashup' contract removed (Order-Fin remediation
  // Phase 5): the Cash Up screen is superseded by cash drawer sessions + the
  // D-09 reconciliation report (finding FN-06).
]

export const BILLING_INVOICES_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/invoices')!
export const BILLING_INTERNAL_FIN_AR_AGING_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/ar/aging')!
export const BILLING_INTERNAL_FIN_AR_CREDITS_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/ar/credits')!
export const BILLING_INTERNAL_FIN_AR_CUSTOMERS_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/ar/customers')!
export const BILLING_INTERNAL_FIN_AR_CYCLES_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/ar/cycles')!
export const BILLING_INTERNAL_FIN_AR_DISPUTES_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/ar/disputes')!
export const BILLING_INTERNAL_FIN_AR_DUNNING_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/ar/dunning')!
export const BILLING_INTERNAL_FIN_AR_LEDGER_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/ar/ledger')!
export const BILLING_INTERNAL_FIN_AR_STATEMENTS_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/ar/statements')!
export const BILLING_INTERNAL_FIN_AR_STATEMENTS_PRINT_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/ar/statements/print')!
export const BILLING_INTERNAL_FIN_CASH_DRAWERS_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/cash-drawers')!
export const BILLING_INTERNAL_FIN_CASH_DRAWERS_SESSION_ACCESS =
  BILLING_ACCESS_CONTRACTS.find(
    (contract) =>
      contract.routePattern === '/dashboard/internal_fin/cash-drawers/[drawerId]/session/[sessionId]',
  )!
export const BILLING_INTERNAL_FIN_CASH_DRAWERS_SESSION_PRINT_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/cash-drawers/[drawerId]/session/[sessionId]/print')!
export const BILLING_INTERNAL_FIN_INVOICES_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/invoices')!
export const BILLING_INTERNAL_FIN_INVOICES_PRINT_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/invoices/[id]/print')!
export const BILLING_INTERNAL_FIN_INVOICES_NEW_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/invoices/new')!
export const BILLING_INTERNAL_FIN_RECONCILIATION_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/reconciliation')!
export const BILLING_INTERNAL_FIN_REFUNDS_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/refunds')!
