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
    apiDependencies: [
      {
        label: 'Drawer hub list with the resolved cash-control policy (CLF-8-6)',
        method: 'GET',
        path: '/api/v1/cash-drawers',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Drawer overview aggregate (CLF-8-7)',
        method: 'GET',
        path: '/api/v1/cash-drawers/overview',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
    ],
    notes: ['Cash drawer operations route with explicit page gate from navigation. Read-only hub: opening and closing happen on the drawer detail route.'],
  },
  {
    routePattern: '/dashboard/internal_fin/cash-drawers/follow-up',
    label: 'Cash Deposit Follow-up',
    page: {
      permissions: ['cash_drawer:view_reports'],
      requireAllPermissions: true,
    },
    actions: {
      updatePostClose: {
        label: 'Update the post-close status / notes of a session',
        requirement: {
          permissions: ['cash_drawer:post_close_update'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Follow-up list: sessions whose cash went to a pending-deposit drawer (CLF-8-9)',
        method: 'GET',
        path: '/api/v1/cash-drawers/follow-up',
        requirement: { permissions: ['cash_drawer:view_reports'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Post-close status catalog for the filter and editor (CLF-8-9)',
        method: 'GET',
        path: '/api/v1/cash-drawers/catalogs',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Post-close status update (CLF-8-9 inline editor)',
        method: 'PUT',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/post-close',
        requirement: { permissions: ['cash_drawer:post_close_update'], requireAllPermissions: true },
        enforcement: 'permission',
      },
    ],
    notes: ['Worklist for cash sent to PENDING_DEPOSIT drawers at close. Nav entry: migration 0541 / navigation.ts billing_cash_drawer_followup.'],
  },
  {
    routePattern: '/dashboard/internal_fin/cash-drawers/[drawerId]',
    label: 'Cash Drawer Details',
    page: {
      permissions: ['cash_drawer:view'],
      requireAllPermissions: true,
    },
    actions: {
      openSession: {
        label: 'Open a session (opening count) on the drawer',
        requirement: { permissions: ['cash_drawer:open_session'], requireAllPermissions: true },
      },
      closeCount: {
        label: 'Close wizard: count step, freezes the ledger cut',
        requirement: { permissions: ['cash_drawer:close_session'], requireAllPermissions: true },
      },
      closeFinalize: {
        label: 'Close wizard: choose disposition and finalize the close',
        requirement: { permissions: ['cash_drawer:close_session'], requireAllPermissions: true },
      },
      recordMovement: {
        label: 'Cash in / cash out on the open session',
        requirement: { permissions: ['cash_drawer:record_movement'], requireAllPermissions: true },
      },
      transfer: {
        label: 'Post or reverse a custody drawer transaction',
        requirement: { permissions: ['cash_drawer:transfer'], requireAllPermissions: true },
      },
      count: {
        label: 'Record a standalone spot count',
        requirement: { permissions: ['cash_drawer:count'], requireAllPermissions: true },
      },
      policyEdit: {
        label: 'Edit the drawer-level cash-control policy overrides',
        requirement: { permissions: ['cash_control:manage'], requireAllPermissions: true },
      },
    },
    apiDependencies: [
      {
        label: 'Drawer overview aggregate (CLF-8-7)',
        method: 'GET',
        path: '/api/v1/cash-drawers/overview',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Open a session with an opening count (CLF-4)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/open-session-v2',
        requirement: { permissions: ['cash_drawer:open_session'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Session list for the drawer',
        method: 'GET',
        path: '/api/v1/cash-drawers/[drawerId]/sessions',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Close wizard: preview the cut (CLF-8-5)',
        method: 'GET',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/close-preview',
        requirement: { permissions: ['cash_drawer:close_session'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Close wizard: count step (CLF-8-5)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/close/count',
        requirement: { permissions: ['cash_drawer:close_session'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Close wizard: finalize with disposition (CLF-8-5)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/close/finalize',
        requirement: { permissions: ['cash_drawer:close_session'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Cash rounding policy for the drawer currency (A6-1b)',
        method: 'GET',
        path: '/api/v1/cash-drawers/rounding-policy',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Cash in / Cash out (CLF W11)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/cash-in-out',
        requirement: { permissions: ['cash_drawer:record_movement'], requireAllPermissions: true },
        enforcement: 'permission',
        notes: ['Replaces the deleted POST .../cash-movement route.'],
      },
      {
        label: 'Drawer ledger (CLF-7, CLF-8-7 Ledger tab)',
        method: 'GET',
        path: '/api/v1/cash-drawers/[drawerId]/ledger',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Record a standalone count (CLF-7, CLF-8-7 Counts tab)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/counts',
        requirement: { permissions: ['cash_drawer:count'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'List count history (CLF-7, CLF-8-7 Counts tab)',
        method: 'GET',
        path: '/api/v1/cash-drawers/[drawerId]/counts',
        requirement: { permissions: ['cash_drawer:count'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Load drawer policy with source (CLF-7, CLF-8-7 Policy tab)',
        method: 'GET',
        path: '/api/v1/cash-drawers/[drawerId]/policy',
        requirement: { permissions: ['cash_control:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Update drawer policy overrides (CLF-7, CLF-8-7 Policy tab)',
        method: 'PUT',
        path: '/api/v1/cash-drawers/[drawerId]/policy',
        requirement: { permissions: ['cash_control:manage'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Post a custody drawer transaction (CLF-7, CLF-8-6 Transaction dialog)',
        method: 'POST',
        path: '/api/v1/cash-drawers/trx',
        requirement: { permissions: ['cash_drawer:transfer'], requireAllPermissions: true },
        enforcement: 'permission',
        notes: ['Not drawer-scoped in the URL (one or more drawers per transaction); attached here as its primary consuming page.'],
      },
      {
        label: 'List custody drawer transactions (CLF-7, CLF-8-7 Transactions tab)',
        method: 'GET',
        path: '/api/v1/cash-drawers/trx',
        requirement: { permissions: ['cash_drawer:transfer'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Reverse a custody drawer transaction (CLF-7, CLF-8-7 Transactions tab)',
        method: 'POST',
        path: '/api/v1/cash-drawers/trx/[trxId]/reverse',
        requirement: { permissions: ['cash_drawer:transfer'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Cash-drawer catalogs (CLF-7, CLF-8-5 close wizard + CLF-8-10 drawer config form)',
        method: 'GET',
        path: '/api/v1/cash-drawers/catalogs',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Currency denominations (CLF-7, CLF-8-1 CmxDenominationCounter)',
        method: 'GET',
        path: '/api/v1/currencies/[code]/denominations',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
    ],
    notes: ['Cash drawer detail route inherits the same page gate as the list view.'],
  },
  {
    routePattern: '/dashboard/internal_fin/cash-drawers/[drawerId]/session/[sessionId]',
    label: 'Cash Drawer Session Details',
    page: {
      permissions: ['cash_drawer:view'],
      requireAllPermissions: true,
    },
    actions: {
      approveVariance: {
        label: 'Approve a pending close-variance',
        requirement: { permissions: ['cash_drawer:approve_variance'], requireAllPermissions: true },
      },
      postCloseUpdate: {
        label: 'Update the post-close status / notes of the session',
        requirement: { permissions: ['cash_drawer:post_close_update'], requireAllPermissions: true },
      },
    },
    apiDependencies: [
      {
        label: 'Session detail',
        method: 'GET',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Session close summary (print / header)',
        method: 'GET',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/summary',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Approve a pending close-variance',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/approve-variance',
        requirement: { permissions: ['cash_drawer:approve_variance'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Close preview (CLF-7, C2-1 absorbed)',
        method: 'GET',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/close-preview',
        requirement: { permissions: ['cash_drawer:close_session'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Close wizard — count step (CLF-7, CLF-8-5)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/close/count',
        requirement: { permissions: ['cash_drawer:close_session'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Close wizard — supervisor recount (CLF-7, CLF-8-5)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/close/recount',
        requirement: { permissions: ['cash_drawer:approve_variance'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Close wizard — finalize (CLF-7, CLF-8-5)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/close/finalize',
        requirement: { permissions: ['cash_drawer:close_session'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Supervisor force-close (CLF-7)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/force-close',
        requirement: { permissions: ['pos_session:force_close'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Session closure view: balances, counts, disposition, post-close log (CLF-8-8)',
        method: 'GET',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/closure',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Post-close status update (CLF-7, CLF-8-8 session detail)',
        method: 'PUT',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/post-close',
        requirement: { permissions: ['cash_drawer:post_close_update'], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Post-close change log (CLF-7, CLF-8-8 session detail)',
        method: 'GET',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/post-close/history',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
        enforcement: 'permission',
      },
    ],
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
    routePattern: '/dashboard/internal_fin/outbox',
    label: 'Financial Outbox Monitor',
    page: {
      permissions: ['finance_outbox:view'],
      requireAllPermissions: true,
    },
    actions: {
      retryEvent: {
        label: 'Manually retry a FAILED or DEAD_LETTERED outbox event',
        requirement: {
          permissions: ['finance_outbox:retry'],
          requireAllPermissions: true,
        },
      },
      retryMatchingEvents: {
        label: 'Bulk retry FAILED or DEAD_LETTERED outbox events matching the current filter',
        requirement: {
          permissions: ['finance_outbox:retry'],
          requireAllPermissions: true,
        },
      },
      viewEventDetail: {
        label: 'Open an outbox event detail dialog (payload, related records, sibling events)',
        requirement: {
          permissions: ['finance_outbox:view'],
          requireAllPermissions: true,
        },
      },
      viewFinanceJobs: {
        label: 'View the scheduled finance jobs hub (outbox processor, gift-card expiry, credit-note expiry, idempotency cleanup, ERP posting-retry)',
        requirement: {
          permissions: ['finance_jobs:view'],
          requireAllPermissions: true,
        },
      },
      viewJobHistory: {
        label: 'Open run history for a finance job',
        requirement: {
          permissions: ['finance_jobs:view'],
          requireAllPermissions: true,
        },
      },
      runFinanceJob: {
        label: 'Manually trigger an on-demand run of a scheduled finance job (confirm + overlap rejected)',
        requirement: {
          permissions: ['finance_jobs:run'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Outbox health counts + event list',
        method: 'GET',
        path: '/api/v1/finance/outbox',
        requirement: {
          permissions: ['finance_outbox:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Manually retry an outbox event',
        method: 'POST',
        path: '/api/v1/finance/outbox/[eventId]/retry',
        requirement: {
          permissions: ['finance_outbox:retry'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Outbox event detail (payload + related records)',
        method: 'GET',
        path: '/api/v1/finance/outbox/[eventId]',
        requirement: {
          permissions: ['finance_outbox:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Bulk retry matching FAILED or DEAD_LETTERED outbox events',
        method: 'POST',
        path: '/api/v1/finance/outbox/retry-bulk',
        requirement: {
          permissions: ['finance_outbox:retry'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Finance jobs catalog + last run + cron health',
        method: 'GET',
        path: '/api/v1/finance/jobs',
        requirement: {
          permissions: ['finance_jobs:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Finance job run history',
        method: 'GET',
        path: '/api/v1/finance/jobs/[jobCode]/runs',
        requirement: {
          permissions: ['finance_jobs:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Manually run a finance job',
        method: 'POST',
        path: '/api/v1/finance/jobs/[jobCode]/run',
        requirement: {
          permissions: ['finance_jobs:run'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: [
      'B7 — ops-visibility screen for the financial domain-event outbox (pending/failed/dead-lettered counts, event detail, related-record links, bulk retry).',
      'The scheduled processor route (/api/finance/process-outbox) is bearer-secret authenticated (pg_cron), not a user-facing route — no contract entry. Manual Run Now for outbox_processor uses POST /api/v1/finance/jobs/[jobCode]/run.',
      'Jobs hub — outbox processor, gift-card expiry, credit-note expiry, idempotency cleanup, ERP posting-retry. The scheduled dispatcher route (/api/finance/process-jobs) is bearer-secret authenticated (pg_cron), not a user-facing route — no contract entry, same as process-outbox.',
    ],
  },
  {
    routePattern: '/dashboard/internal_fin/pending-payments',
    label: 'Pending Payments',
    page: {
      permissions: ['orders:pending_payments_view'],
      requireAllPermissions: true,
    },
    actions: {
      verifyPayment: {
        label: 'Verify a PENDING/PROCESSING payment leg (flip to COMPLETED)',
        requirement: {
          permissions: ['orders:verify_payment'],
          requireAllPermissions: true,
        },
      },
      cancelPayment: {
        label: 'Cancel a PENDING/PROCESSING payment leg (mandatory reason + D009 fallback)',
        requirement: {
          permissions: ['orders:cancel_payment'],
          requireAllPermissions: true,
        },
      },
      failBouncePayment: {
        label: 'Mark a PENDING/PROCESSING payment leg FAILED/bounced (mandatory reason + D009 fallback)',
        requirement: {
          permissions: ['orders:fail_payment'],
          requireAllPermissions: true,
        },
      },
      voidPayment: {
        label: 'B10 — void a PENDING/PROCESSING payment leg (mistaken/duplicate entry, no money movement)',
        requirement: {
          permissions: ['orders:void_payment'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Pending-payments worklist counts + list',
        method: 'GET',
        path: '/api/v1/finance/pending-payments',
        requirement: {
          permissions: ['orders:pending_payments_view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List drawers to re-place cash the gate refused (VERIFY/REVERSE recovery picker)',
        method: 'GET',
        path: '/api/v1/cash-drawers',
        requirement: {
          permissions: ['cash_drawer:view'],
          requireAllPermissions: true,
        },
        notes: ['Only fetched after the cash-drawer gate refuses a VERIFY/REVERSE placement.'],
      },
      {
        label: 'Cash change rounding policy for the checkout (A6-1b)',
        method: 'GET',
        path: '/api/v1/cash-drawers/rounding-policy',
        requirement: {
          permissions: ['cash_drawer:view'],
          requireAllPermissions: true,
        },
        notes: ['Only fetched after the cash-drawer gate refuses a VERIFY/REVERSE placement.'],
      },
      {
        label: 'Transition a payment leg (VERIFY/CANCEL/FAIL_BOUNCE/VOID/REVERSE)',
        method: 'POST',
        path: '/api/v1/finance/pending-payments/[paymentId]/transition',
        requirement: {
          permissions: [
            'orders:verify_payment',
            'orders:cancel_payment',
            'orders:fail_payment',
            'orders:void_payment',
            'orders:reverse_payment',
          ],
          requireAllPermissions: false,
        },
      },
    ],
    notes: [
      'B30 — cross-order back-office worklist for PENDING/PROCESSING REAL_PAYMENT legs (D001 canonical graph subset).',
      'B10 — the worklist additionally exposes VOID for a PENDING/PROCESSING leg (mistaken/duplicate entry). REVERSE only applies to COMPLETED/CAPTURED/SETTLED legs, which never appear in this PENDING/PROCESSING worklist — its entry point is the order Financial tab (orders-access.ts).',
      'The transition route enforces the action-specific permission dynamically server-side; the contract entry lists all five as any-of since the route itself decides per request body.',
    ],
  },
  {
    routePattern: '/dashboard/internal_fin/refunds',
    label: 'Refunds',
    page: {
      permissions: ['orders:process_refund'],
      requireAllPermissions: true,
    },
    actions: {
      approveRefund: {
        label: 'Approve pending refund (permission-gated server-side; the requester may approve their own)',
        requirement: {
          permissions: ['orders:approve_refund'],
          requireAllPermissions: true,
          featureFlags: ['order_fin_refund_ui'],
          requireAllFeatureFlags: true,
        },
      },
      processRefund: {
        label: 'Process approved refund',
        requirement: {
          permissions: ['orders:process_refund'],
          requireAllPermissions: true,
          featureFlags: ['order_fin_refund_ui'],
          requireAllFeatureFlags: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Approve refund',
        method: 'PATCH',
        path: '/api/v1/orders/refunds/[refundId]/approve',
        requirement: {
          permissions: ['orders:approve_refund'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Process refund',
        method: 'PATCH',
        path: '/api/v1/orders/refunds/[refundId]/process',
        requirement: {
          permissions: ['orders:process_refund'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: [
      'Refund workbench route using the same page gate exposed in navigation.',
      'B34: stage actions (approve/process) render only behind the order_fin_refund_ui feature flag — disabled by default; production activation gated on B01+B02 VERIFIED per the B34 Safety block.',
    ],
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
export const BILLING_INTERNAL_FIN_CASH_DRAWER_FOLLOW_UP_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/cash-drawers/follow-up')!
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
export const BILLING_INTERNAL_FIN_OUTBOX_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/outbox')!
export const BILLING_INTERNAL_FIN_REFUNDS_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/refunds')!
export const BILLING_INTERNAL_FIN_PENDING_PAYMENTS_ACCESS =
  BILLING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/internal_fin/pending-payments')!
