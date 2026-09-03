import type { PageAccessContract } from '@/lib/auth/access-contracts'

const ORDER_NOTES = [
  'No explicit page-level UI permission gate; route relies on navigation visibility and backend enforcement.',
]

export const ORDERS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/orders',
    label: 'Orders',
    page: {},
    apiDependencies: [
      {
        label: 'List orders',
        method: 'GET',
        path: '/api/v1/orders',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/orders/new',
    label: 'New Order',
    page: {},
    actions: {
      priceOverride: {
        label: 'Use price override controls',
        requirement: {
          permissions: ['pricing:override'],
          requireAllPermissions: true,
        },
      },
      useB2bCustomerOptions: {
        label: 'Use B2B customer options',
        requirement: {
          featureFlags: ['b2b_contracts'],
          requireAllFeatureFlags: true,
        },
      },
      payExtraAllocateOverpayment: {
        label: 'Pay extra: auto / manual allocate excess',
        requirement: {
          permissions: ['orders:overpayment_allocate'],
          requireAllPermissions: true,
        },
        notes: ['Payment Modal V4 → Validate payment → Extra Receipt dialog.'],
      },
      payExtraIntentEnable: {
        label: 'Pay extra: enable Customer is paying extra toggle',
        requirement: {
          permissions: ['orders:overpayment_allocate'],
          requireAllPermissions: true,
        },
        notes: [
          'QA-R4.5 top strip — toggle ON gate. Distinct from destination allocate action.',
        ],
      },
      payExtraSaveToWallet: {
        label: 'Pay extra: save excess to customer wallet',
        requirement: {
          permissions: ['orders:overpayment_to_wallet'],
          requireAllPermissions: true,
        },
        notes: ['Requires linked customer on the order.'],
      },
      payExtraSaveAsAdvance: {
        label: 'Pay extra: save excess as customer advance',
        requirement: {
          permissions: ['orders:overpayment_to_advance'],
          requireAllPermissions: true,
        },
        notes: ['Also granted by orders:overpayment_dispose in the payment UI.'],
      },
      payExtraSaveAsCredit: {
        label: 'Pay extra: save excess as customer credit',
        requirement: {
          permissions: ['orders:overpayment_to_credit'],
          requireAllPermissions: true,
        },
        notes: ['Also granted by orders:overpayment_dispose or orders:overpayment_to_credit_note.'],
      },
      payExtraDisposeOverpayment: {
        label: 'Pay extra: dispose excess (advance / credit umbrella)',
        requirement: {
          permissions: ['orders:overpayment_dispose'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Invoices From Orders',
        method: 'POST',
        path: '/api/v1/ar/invoices/from-orders',
        requirement: {
          permissions: ['invoices:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Close linked cash drawer session from Session Hub',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/close-session',
        requirement: {
          permissions: ['cash_drawer:close_session'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Load linked cash drawer close totals from Session Hub',
        method: 'GET',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/summary',
        requirement: {
          permissions: ['cash_drawer:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List branch cash drawers from Session Hub',
        method: 'GET',
        path: '/api/v1/cash-drawers',
        requirement: {
          permissions: ['cash_drawer:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Open cash drawer session from Session Hub',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/open-session',
        requirement: {
          permissions: ['cash_drawer:open_session'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Auto-link cash drawer to POS session from Session Hub',
        method: 'POST',
        path: '/api/v1/pos-sessions/auto-link-drawer',
        requirement: {
          permissions: ['pos_session:open', 'cash_drawer:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Orders Checkout Options',
        method: 'GET',
        path: '/api/v1/orders/checkout-options',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Pos Sessions My Active',
        method: 'GET',
        path: '/api/v1/pos-sessions/my-active',
        requirement: {
          permissions: ['pos_session:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'POS Session Hub summary',
        method: 'GET',
        path: '/api/v1/pos-sessions/[sessionId]/summary',
        requirement: {
          permissions: ['pos_session:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Pause POS session from Session Hub',
        method: 'POST',
        path: '/api/v1/pos-sessions/pause',
        requirement: {
          permissions: ['pos_session:pause_resume'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Resume POS session from Session Hub',
        method: 'POST',
        path: '/api/v1/pos-sessions/resume',
        requirement: {
          permissions: ['pos_session:pause_resume'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Close POS session from Session Hub',
        method: 'POST',
        path: '/api/v1/pos-sessions/close',
        requirement: {
          permissions: ['pos_session:close'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Force-close POS session from Session Hub',
        method: 'POST',
        path: '/api/v1/pos-sessions/force-close',
        requirement: {
          permissions: ['pos_session:force_close'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Assembly Dashboard',
        method: 'GET',
        path: '/api/v1/assembly/dashboard',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Catalog Packing Preferences',
        method: 'GET',
        path: '/api/v1/catalog/packing-preferences',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Catalog Preference Kinds',
        method: 'GET',
        path: '/api/v1/catalog/preference-kinds',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Catalog Service Preferences',
        method: 'GET',
        path: '/api/v1/catalog/service-preferences',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Delivery Routes',
        method: 'GET',
        path: '/api/v1/delivery/routes',
        requirement: {
          permissions: ['drivers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Orders [Id]',
        method: 'GET',
        path: '/api/v1/orders/[id]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Batch Update',
        method: 'POST',
        path: '/api/v1/orders/[id]/batch-update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Editability',
        method: 'GET',
        path: '/api/v1/orders/[id]/editability',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] History',
        method: 'GET',
        path: '/api/v1/orders/[id]/history',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Issue',
        method: 'POST',
        path: '/api/v1/orders/[id]/issue',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Issues list',
        method: 'GET',
        path: '/api/v1/orders/[id]/issues',
        notes: ['Auth-only; order/item/piece scoped issue list.'],
      },
      {
        label: '[Id] Issue summary',
        method: 'GET',
        path: '/api/v1/orders/[id]/issue-summary',
        notes: ['Auth-only; open/total counts for badges.'],
      },
      {
        label: '[Id] Issue resolve',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/issue/[issueId]',
        notes: ['Auth-only; sets solved_at/solved_by/solved_notes.'],
      },
      {
        label: 'Tenant issues queue',
        method: 'GET',
        path: '/api/v1/orders/issues',
        notes: ['Auth-only; /dashboard/issues queue.'],
      },
      {
        label: '[ItemId] Pieces',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Pieces [PieceId]',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[PieceId] Conditions',
        method: 'POST',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/conditions',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[PieceId] Service Prefs',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Lock',
        method: 'POST',
        path: '/api/v1/orders/[id]/lock',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Pieces',
        method: 'GET',
        path: '/api/v1/orders/[id]/pieces',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Report Invoices Payments Rprt',
        method: 'GET',
        path: '/api/v1/orders/[id]/report/invoices-payments-rprt',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Report Payments Rprt',
        method: 'GET',
        path: '/api/v1/orders/[id]/report/payments-rprt',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Split',
        method: 'POST',
        path: '/api/v1/orders/[id]/split',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] State',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Transition',
        method: 'POST',
        path: '/api/v1/orders/[id]/transition',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Available workflow actions',
        method: 'GET',
        path: '/api/v1/orders/[id]/available-actions',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Workflow Order Advance V1.0 — listAvailableActions'],
      },
      {
        label: '[Id] Execute workflow action',
        method: 'POST',
        path: '/api/v1/orders/[id]/actions',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: [
          'Workflow Order Advance V1.0 — executeAction; Idempotency-Key required',
        ],
      },
      {
        label: '[Id] Transitions',
        method: 'GET',
        path: '/api/v1/orders/[id]/transitions',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Unlock',
        method: 'GET',
        path: '/api/v1/orders/[id]/unlock',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Update',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Orders Estimate Ready By',
        method: 'GET',
        path: '/api/v1/orders/estimate-ready-by',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'V1 Plan Flags',
        method: 'GET',
        path: '/api/v1/plan-flags',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Pos Sessions Ensure For Order Entry',
        method: 'POST',
        path: '/api/v1/pos-sessions/ensure-for-order-entry',
        requirement: {
          permissions: ['pos_session:open'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Complete',
        method: 'POST',
        path: '/api/v1/preparation/[id]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Items',
        method: 'POST',
        path: '/api/v1/preparation/[id]/items',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Items [ItemId]',
        method: 'PATCH',
        path: '/api/v1/preparation/[id]/items/[itemId]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Preview',
        method: 'GET',
        path: '/api/v1/preparation/[id]/preview',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Processing Steps [Category]',
        method: 'GET',
        path: '/api/v1/processing-steps/[category]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Resend',
        method: 'POST',
        path: '/api/v1/receipts/[id]/resend',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Orders [OrderId]',
        method: 'GET',
        path: '/api/v1/receipts/orders/[orderId]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Server action: inventory-actions',
        method: 'POST',
        path: '/app/actions/inventory/inventory-actions',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Server action: get-currency-config',
        method: 'POST',
        path: '/app/actions/tenant/get-currency-config',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Preview payment',
        method: 'POST',
        path: '/api/v1/orders/preview-payment',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Submit order with payment',
        method: 'POST',
        path: '/api/v1/orders/submit-order',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Resolve preferences',
        method: 'POST',
        path: '/api/v1/preferences/resolve',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Suggest preferences',
        method: 'GET',
        path: '/api/v1/preferences/suggest',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Repeat last order',
        method: 'GET',
        path: '/api/v1/preferences/last-order',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Default guest customer',
        method: 'GET',
        path: '/api/v1/tenant-settings/default-guest-customer',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Search customers',
        method: 'GET',
        path: '/api/v1/customers',
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
        label: 'List B2B contracts',
        method: 'GET',
        path: '/api/v1/b2b-contracts?customer_id=[customerId]',
        requirement: {
          permissions: ['b2b_contracts:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List categories',
        method: 'GET',
        path: '/api/v1/categories',
        notes: [
          'GET with ?enabled=true query filter.',
          'Auth-only local route; explicit permission requirement not recorded in local API inventory.',
        ],
      },
      {
        label: 'List products',
        method: 'GET',
        path: '/api/v1/products',
        requirement: {
          permissions: ['products:read'],
          requireAllPermissions: true,
        },
        notes: [
          'New Order grid: searchScope=name; optional global search omits category param; page/limit from client pagination.',
        ],
      },
      {
        label: 'Preview auto receipt allocation',
        method: 'POST',
        path: '/api/v1/customer-receipts/allocation/preview-auto',
        requirement: {
          permissions: ['orders:overpayment_allocate'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Confirm receipt allocation',
        method: 'POST',
        path: '/api/v1/customer-receipts/allocation/post',
        requirement: {
          permissions: ['orders:overpayment_allocate'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/orders/[id]',
    label: 'Order Details',
    page: {
      permissions: ['orders:view_financial_breakdown'],
      requireAllPermissions: true,},
    apiDependencies: [
      {
        label: 'Delivery proof and handover audit',
        method: 'GET',
        path: '/api/v1/delivery/orders/[orderId]/proof',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
        notes: ['Returns tenant-scoped proof records and time-limited private evidence links.'],
      },
      {
        label: 'Ar *',
        method: 'GET',
        path: '/api/v1/ar/*',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Invoices From Orders',
        method: 'POST',
        path: '/api/v1/ar/invoices/from-orders',
        requirement: {
          permissions: ['invoices:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Orders Checkout Options',
        method: 'GET',
        path: '/api/v1/orders/checkout-options',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Pos Sessions My Active',
        method: 'GET',
        path: '/api/v1/pos-sessions/my-active',
        requirement: {
          permissions: ['pos_session:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Server action: get-order',
        method: 'POST',
        path: '/app/actions/orders/get-order',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Server action: get-order-edit-history',
        method: 'POST',
        path: '/app/actions/orders/get-order-edit-history',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Server action: get-order-financial',
        method: 'POST',
        path: '/app/actions/orders/get-order-financial',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Server action: get-order-preferences',
        method: 'POST',
        path: '/app/actions/orders/get-order-preferences',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Server action: invoice-actions',
        method: 'POST',
        path: '/app/actions/payments/invoice-actions',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Get order',
        method: 'GET',
        path: '/api/v1/orders/[id]',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Order transitions',
        method: 'GET',
        path: '/api/v1/orders/[id]/transitions',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Initiate refund (B34 dialog)',
        method: 'POST',
        path: '/api/v1/orders/[id]/refunds',
        requirement: {
          permissions: ['orders:process_refund'],
          requireAllPermissions: true,
        },
        notes: ['B34: used by the flag-gated initiate-refund dialog on the Financial tab.'],
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
        notes: ['B30/B10: shared back-office transition endpoint also used by the Financial tab payments table Cancel/Fail-Bounce/Void/Reverse buttons.'],
      },
    ],
    notes: ORDER_NOTES,
    actions: {
      verify_payment: {
        label: 'Verify Payment',
        requirement: {
          permissions: ['orders:verify_payment'],
          requireAllPermissions: true,
        },
      },
      initiateRefund: {
        label: 'Initiate refund (Financial tab dialog)',
        requirement: {
          permissions: ['orders:process_refund'],
          requireAllPermissions: true,
          featureFlags: ['order_fin_refund_ui'],
          requireAllFeatureFlags: true,
        },
      },
      void_payment: {
        label: 'B10 — Void a PENDING/PROCESSING/AUTHORIZED payment leg',
        requirement: {
          permissions: ['orders:void_payment'],
          requireAllPermissions: true,
        },
      },
      reverse_payment: {
        label: 'B10 — Reverse a COMPLETED/CAPTURED/SETTLED payment leg',
        requirement: {
          permissions: ['orders:reverse_payment'],
          requireAllPermissions: true,
        },
      },
    },
},
  {
    routePattern: '/dashboard/orders/[id]/edit',
    label: 'Edit Order',
    page: {},
    apiDependencies: [
      {
        label: 'Assembly Dashboard',
        method: 'GET',
        path: '/api/v1/assembly/dashboard',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Catalog Packing Preferences',
        method: 'GET',
        path: '/api/v1/catalog/packing-preferences',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Catalog Preference Kinds',
        method: 'GET',
        path: '/api/v1/catalog/preference-kinds',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Catalog Service Preferences',
        method: 'GET',
        path: '/api/v1/catalog/service-preferences',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'V1 Categories',
        method: 'GET',
        path: '/api/v1/categories',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Allocation Post',
        method: 'POST',
        path: '/api/v1/customer-receipts/allocation/post',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Allocation Preview Auto',
        method: 'POST',
        path: '/api/v1/customer-receipts/allocation/preview-auto',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'V1 Customers',
        method: 'POST',
        path: '/api/v1/customers',
        requirement: {
          permissions: ['customers:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Delivery Routes',
        method: 'GET',
        path: '/api/v1/delivery/routes',
        requirement: {
          permissions: ['drivers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Orders Estimate Ready By',
        method: 'GET',
        path: '/api/v1/orders/estimate-ready-by',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Orders Preview Payment',
        method: 'POST',
        path: '/api/v1/orders/preview-payment',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Orders Submit Order',
        method: 'POST',
        path: '/api/v1/orders/submit-order',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'V1 Plan Flags',
        method: 'GET',
        path: '/api/v1/plan-flags',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Pos Sessions Ensure For Order Entry',
        method: 'POST',
        path: '/api/v1/pos-sessions/ensure-for-order-entry',
        requirement: {
          permissions: ['pos_session:open'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Pos Sessions My Active',
        method: 'GET',
        path: '/api/v1/pos-sessions/my-active',
        requirement: {
          permissions: ['pos_session:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Preferences Last Order',
        method: 'GET',
        path: '/api/v1/preferences/last-order',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Preferences Resolve',
        method: 'GET',
        path: '/api/v1/preferences/resolve',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Preferences Suggest',
        method: 'GET',
        path: '/api/v1/preferences/suggest',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Complete',
        method: 'POST',
        path: '/api/v1/preparation/[id]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Items',
        method: 'POST',
        path: '/api/v1/preparation/[id]/items',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Items [ItemId]',
        method: 'PATCH',
        path: '/api/v1/preparation/[id]/items/[itemId]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Preview',
        method: 'GET',
        path: '/api/v1/preparation/[id]/preview',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Processing Steps [Category]',
        method: 'GET',
        path: '/api/v1/processing-steps/[category]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'V1 Products',
        method: 'GET',
        path: '/api/v1/products',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Resend',
        method: 'POST',
        path: '/api/v1/receipts/[id]/resend',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Orders [OrderId]',
        method: 'GET',
        path: '/api/v1/receipts/orders/[orderId]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Tenant Settings Default Guest Customer',
        method: 'GET',
        path: '/api/v1/tenant-settings/default-guest-customer',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Server action: inventory-actions',
        method: 'POST',
        path: '/app/actions/inventory/inventory-actions',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Server action: get-currency-config',
        method: 'POST',
        path: '/app/actions/tenant/get-currency-config',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Get order',
        method: 'GET',
        path: '/api/v1/orders/[id]',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Editability',
        method: 'GET',
        path: '/api/v1/orders/[id]/editability',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Lock order',
        method: 'POST',
        path: '/api/v1/orders/[id]/lock',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Unlock order',
        method: 'POST',
        path: '/api/v1/orders/[id]/unlock',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Update order',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/orders/[id]/prepare',
    label: 'Prepare Order',
    page: {},
    notes: ORDER_NOTES,
    apiDependencies: [
      {
        label: 'Server action: find-or-create-product',
        method: 'POST',
        path: '/app/actions/catalog/find-or-create-product',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Server action: add-order-items',
        method: 'POST',
        path: '/app/actions/orders/add-order-items',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Server action: complete-preparation',
        method: 'POST',
        path: '/app/actions/orders/complete-preparation',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Server action: get-order',
        method: 'POST',
        path: '/app/actions/orders/get-order',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
    ],
    actions: {
      transition: {
        label: 'Transition',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      update: {
        label: 'Update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    },
},
  {
    routePattern: '/dashboard/orders/[id]/full',
    label: 'Full Order Details',
    page: {},
    notes: ORDER_NOTES,
    apiDependencies: [
      {
        label: 'Ar *',
        method: 'GET',
        path: '/api/v1/ar/*',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Invoices From Orders',
        method: 'POST',
        path: '/api/v1/ar/invoices/from-orders',
        requirement: {
          permissions: ['invoices:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Confirm Physical Intake',
        method: 'POST',
        path: '/api/v1/orders/[id]/confirm-physical-intake',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Fix Order Data',
        method: 'GET',
        path: '/api/v1/orders/[id]/fix-order-data',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Pieces',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Pieces [Id]',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/[id]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Pieces Scan',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/scan',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] State',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Transitions',
        method: 'GET',
        path: '/api/v1/orders/[id]/transitions',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Server action: get-order',
        method: 'POST',
        path: '/app/actions/orders/get-order',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Server action: get-order-edit-history',
        method: 'POST',
        path: '/app/actions/orders/get-order-edit-history',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Server action: get-order-financial',
        method: 'POST',
        path: '/app/actions/orders/get-order-financial',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Server action: get-order-preferences',
        method: 'POST',
        path: '/app/actions/orders/get-order-preferences',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'Server action: invoice-actions',
        method: 'POST',
        path: '/app/actions/payments/invoice-actions',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
    ],
},
  {
    routePattern: '/dashboard/preparation',
    label: 'Preparation',
    page: {},
    apiDependencies: [
      {
        label: 'Floor worklist',
        method: 'GET',
        path: '/api/v1/orders',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
        notes: ['workflow_screen selects artifact, pinned-graph, or live catalog membership.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/preparation/[orderId]',
    label: 'Preparation Details',
    page: {},
    actions: {
      completeAndContinue: {
        label: 'Complete & Continue (to processing)',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      editPiecePreferences: {
        label: 'Edit piece preferences',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Preparation preview',
        method: 'GET',
        path: '/api/v1/preparation/[id]/preview',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Preparation items',
        method: 'POST',
        path: '/api/v1/preparation/[id]/items',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Preparation item delete',
        method: 'DELETE',
        path: '/api/v1/preparation/[id]/items/[itemId]',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Preparation item update',
        method: 'PATCH',
        path: '/api/v1/preparation/[id]/items/[itemId]',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order item pieces list',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order piece update',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Piece service preferences',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Piece service preferences mutate',
        method: 'POST',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Piece conditions replace',
        method: 'POST',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/conditions',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Complete preparation (legacy API)',
        method: 'POST',
        path: '/api/v1/preparation/[id]/complete',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Transition order (Complete & Continue)',
        method: 'POST',
        path: '/api/v1/orders/[id]/transition',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Server action: get-order (prep)',
        method: 'POST',
        path: '/app/actions/orders/get-order',
        notes: [
          'Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.',
        ],
      },
    ],
    notes: [
      ...ORDER_NOTES,
      'Detail page blocks Complete when order status is not intake/preparing/preparation; UI uses /api/v1/orders/[id]/transition to processing.',
    ],
  },
  {
    routePattern: '/dashboard/issues',
    label: 'Order Issues',
    page: {},
    apiDependencies: [
      {
        label: 'Tenant issues queue',
        method: 'GET',
        path: '/api/v1/orders/issues',
        notes: [
          'Auth-only; filters: status, scope, priority; /dashboard/issues queue.',
        ],
      },
      {
        label: 'Resolve issue',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/issue/[issueId]',
        notes: ['Auth-only; solve from issues queue.'],
      },
      {
        label: 'Issue types lookup',
        method: 'GET',
        path: '/api/v1/lookups/issue-types',
        notes: ['Auth-only; active sys_issue_type_cd via lookups/issue-type-lookup.service (HQ read-only).'],
        enforcement: 'auth_only',
      },
      {
        label: 'Priorities lookup',
        method: 'GET',
        path: '/api/v1/lookups/priorities',
        notes: ['Auth-only; active sys_lkp_priority_cd via lookups/priority-lookup.service (HQ read-only).'],
        enforcement: 'auth_only',
      },
    ],
    notes: [
      ...ORDER_NOTES,
      'Auth-only issues queue; sidebar nav orders_issues; IssuesWidget → /dashboard/issues.',
    ],
  },
  {
    routePattern: '/dashboard/processing',
    label: 'Processing',
    page: {},
    apiDependencies: [
      {
        label: 'Floor worklist',
        method: 'GET',
        path: '/api/v1/orders',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
        notes: ['workflow_screen selects artifact, pinned-graph, or live catalog membership.'],
      },
      {
        label: 'Order state (Simple Processing)',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; used by Simple Processing dialog on list.'],
      },
      {
        label: 'Order pieces (Simple Processing)',
        method: 'GET',
        path: '/api/v1/orders/[id]/pieces',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Batch update (Simple Processing)',
        method: 'POST',
        path: '/api/v1/orders/[id]/batch-update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Split order (Simple Processing)',
        method: 'POST',
        path: '/api/v1/orders/[id]/split',
        notes: ['Auth-only local route; used when Split is confirmed from Simple Processing.'],
      },
      {
        label: 'Report issue (Simple Processing)',
        method: 'POST',
        path: '/api/v1/orders/[id]/issue',
        notes: ['Auth-only local route; Report Issue from Simple Processing header.'],
      },
      {
        label: 'Complete processing (list Mark Ready)',
        method: 'POST',
        path: '/api/v1/processing/[id]/complete',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Processing table Mark Ready uses the stage-owned command; no toStatus guess.'],
      },
      {
        label: 'Piece preferences list/add (Simple Processing)',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/preferences',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
        notes: ['POST add uses orders:update; Processing dialog prefs surface.'],
      },
      {
        label: 'Piece preferences add (Simple Processing)',
        method: 'POST',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/preferences',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Piece preference delete/confirm (Simple Processing)',
        method: 'DELETE',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/preferences/[prefId]',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
        notes: ['PATCH confirm on same path; triple-guard delete.'],
      },
      {
        label: 'Piece preference confirm (Simple Processing)',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/preferences/[prefId]',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Piece preference follow-up note (Simple Processing)',
        method: 'POST',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/preferences/[prefId]/notes',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/processing/[id]',
    label: 'Processing Details',
    page: {},
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Processing steps',
        method: 'GET',
        path: '/api/v1/processing-steps/[category]',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Order pieces',
        method: 'GET',
        path: '/api/v1/orders/[id]/pieces',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Batch update order',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/batch-update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Split order',
        method: 'POST',
        path: '/api/v1/orders/[id]/split',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Transition order',
        method: 'POST',
        path: '/api/v1/orders/[id]/transition',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Complete processing',
        method: 'POST',
        path: '/api/v1/processing/[id]/complete',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Stage-owned COMPLETE_PROCESSING; Idempotency-Key required. Destination is owned by the compiled artifact.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/assembly',
    label: 'Assembly',
    page: {},
    apiDependencies: [
      {
        label: 'Floor worklist',
        method: 'GET',
        path: '/api/v1/orders',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
        notes: ['workflow_screen selects artifact, pinned-graph, or live catalog membership.'],
      },
      {
        label: 'Assembly dashboard',
        method: 'GET',
        path: '/api/v1/assembly/dashboard',
        requirement: { permissions: ['orders:read'] },
      },
      {
        label: 'Create assembly task',
        method: 'POST',
        path: '/api/v1/assembly/tasks',
        requirement: { permissions: ['orders:transition'] },
      },
      {
        label: 'Get assembly task',
        method: 'GET',
        path: '/api/v1/assembly/tasks/[taskId]',
        requirement: { permissions: ['orders:read'] },
        notes: ['Loads task metrics and items for the assembly modal.'],
      },
      {
        label: 'Start assembly task',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/start',
        requirement: { permissions: ['orders:transition'] },
        notes: ['Auto-started when the assembly modal opens.'],
      },
      {
        label: 'Scan or mark assembly item',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/scan',
        requirement: { permissions: ['orders:transition'] },
        notes: ['Accepts barcode or assemblyItemId for manual select.'],
      },
      {
        label: 'Complete assembly task',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/complete',
        requirement: { permissions: ['orders:transition'] },
        notes: ['Marks assembly verified before order workflow advance.'],
      },
      {
        label: 'Create assembly exception',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/exceptions',
        requirement: { permissions: ['orders:transition'] },
      },
      {
        label: 'Assembly task QA',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/qa',
        requirement: { permissions: ['orders:transition'] },
      },
      {
        label: 'Pack assembly order',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/pack',
        requirement: { permissions: ['orders:transition'] },
      },
      {
        label: 'Resolve assembly exception',
        method: 'PATCH',
        path: '/api/v1/assembly/exceptions/[id]/resolve',
        requirement: { permissions: ['orders:transition'] },
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/assembly/[id]',
    label: 'Assembly Details',
    page: {},
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Assembly dashboard',
        method: 'GET',
        path: '/api/v1/assembly/dashboard',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Complete assembly',
        method: 'POST',
        path: '/api/v1/assembly/[id]/complete',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Stage-owned COMPLETE_ASSEMBLY; Idempotency-Key required.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/qa',
    label: 'Quality Check',
    page: {},
    apiDependencies: [
      {
        label: 'Floor worklist',
        method: 'GET',
        path: '/api/v1/orders',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
        notes: ['workflow_screen selects artifact, pinned-graph, or live catalog membership.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/qa/[id]',
    label: 'Quality Check Details',
    page: {},
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Create issue',
        method: 'POST',
        path: '/api/v1/orders/[id]/issue',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Pass quality check',
        method: 'POST',
        path: '/api/v1/qa/[id]/pass',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Stage-owned PASS_QA; Idempotency-Key required.'],
      },
      {
        label: 'Fail quality check',
        method: 'POST',
        path: '/api/v1/qa/[id]/fail',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Stage-owned FAIL_QA; reason required; Idempotency-Key required.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/ready',
    label: 'Ready',
    page: {},
    apiDependencies: [
      {
        label: 'Floor worklist',
        method: 'GET',
        path: '/api/v1/orders',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
        notes: [
          'workflow_screen=ready selects artifact membership, including pickup_handover ready-area statuses.',
          'Pickup-desk alias is ?focus=counter on this same route. Stacked API flags ready_staged|ready_unreleased|ready_due|ready_norack apply only on the Ready floor.',
        ],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/ready/[id]',
    label: 'Ready Details',
    page: {},
    actions: {
      payExtraIntentEnable: {
        label: 'Collect payment: enable Customer is paying extra toggle',
        requirement: {
          permissions: ['orders:overpayment_allocate'],
          requireAllPermissions: true,
        },
        notes: ['QA-R4.5 — OrderCollectPaymentModal top strip.'],
      },
      confirmCustomerPickup: {
        label: 'Confirm customer pickup',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Atomic pickup handover command; payment collection remains a separate Order Fin action.'],
      },
      makeAvailableForPickup: {
        label: 'Make available for pickup',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Stage-owned RELEASE_FOR_PICKUP; Ready fulfilment panel owns this CTA.'],
      },
    },
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Collect payment on order',
        method: 'POST',
        path: '/api/v1/orders/[id]/payments',
        requirement: {
          permissions: ['orders:collect_payment'],
          requireAllPermissions: true,
        },
        notes: ['OrderCollectPaymentModal submit.'],
      },
      {
        label: 'Confirm customer pickup',
        method: 'POST',
        path: '/api/v1/pickup/orders/[orderId]/complete',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Atomic tenant-scoped counter handover command.'],
      },
      {
        label: 'Make available for pickup',
        method: 'POST',
        path: '/api/v1/ready/[id]/release-pickup',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Stage-owned RELEASE_FOR_PICKUP; Idempotency-Key required.'],
      },
      {
        label: 'Release for delivery',
        method: 'POST',
        path: '/api/v1/ready/[id]/release-delivery',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Stage-owned RELEASE_FOR_DELIVERY; Idempotency-Key required.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/ready/[id]/print/[type]',
    label: 'Print Ready Document',
    page: {},
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Order history',
        method: 'GET',
        path: '/api/v1/orders/[id]/history',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Print invoice and payments report',
        method: 'GET',
        path: '/api/v1/orders/[id]/report/invoices-payments-rprt',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Print payments report',
        method: 'GET',
        path: '/api/v1/orders/[id]/report/payments-rprt',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/packing',
    label: 'Packing',
    page: {},
    apiDependencies: [
      {
        label: 'Floor worklist',
        method: 'GET',
        path: '/api/v1/orders',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
        notes: ['workflow_screen selects artifact, pinned-graph, or live catalog membership.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/packing/[id]',
    label: 'Packing Details',
    page: {},
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Batch update order',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/batch-update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Complete packing',
        method: 'POST',
        path: '/api/v1/packing/[id]/complete',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Stage-owned COMPLETE_PACKING; Idempotency-Key required.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/delivery',
    label: 'Delivery',
    page: {
      permissions: ['drivers:read', 'orders:read'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Floor worklist',
        method: 'GET',
        path: '/api/v1/orders',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
        notes: [
          'workflow_screen selects artifact, pinned-graph, or live catalog membership.',
        ],
      },
      {
        label: 'List delivery routes',
        method: 'GET',
        path: '/api/v1/delivery/routes',
        requirement: {
          permissions: ['drivers:read'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: [
      'Staff delivery writes are fail-closed pending atomic POD, payment, route, and workflow hardening.',
      'Floor complete uses the profile CONFIRM_DELIVERY action and a stage-owned command, matching Ready pickup.',
    ],
    actions: {
      create: {
        label: 'Create',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      export: {
        label: 'Export',
        requirement: {
          permissions: ['orders:export'],
          requireAllPermissions: true,
        },
      },
      update: {
        label: 'Update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    },
},
  {
    routePattern: '/dashboard/delivery/[id]',
    label: 'Delivery Details',
    page: {
      permissions: ['orders:read'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Get active delivery stop',
        method: 'GET',
        path: '/api/v1/delivery/orders/[orderId]/active-stop',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Complete delivery from floor',
        method: 'POST',
        path: '/api/v1/delivery/orders/[orderId]/complete',
        requirement: {
          permissions: ['delivery:pod', 'orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Stage-owned CONFIRM_DELIVERY when the profile does not require an active stop.'],
      },
      {
        label: 'Collect payment on order',
        method: 'POST',
        path: '/api/v1/orders/[id]/payments',
        requirement: {
          permissions: ['orders:collect_payment'],
          requireAllPermissions: true,
        },
        notes: ['OrderCollectPaymentModal submit.'],
      },
      {
        label: 'List active delivery proof methods',
        method: 'GET',
        path: '/api/v1/delivery/pod-methods',
        requirement: {
          permissions: ['delivery:pod', 'orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Used when an active stop is present and the existing proof panel is shown.'],
      },
      {
        label: 'Create private delivery evidence receipt',
        method: 'POST',
        path: '/api/v1/delivery/stops/[stopId]/evidence',
        requirement: {
          permissions: ['delivery:pod', 'orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Complete delivery atomically',
        method: 'POST',
        path: '/api/v1/delivery/stops/[stopId]/complete',
        requirement: {
          permissions: ['delivery:pod', 'orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Used when this order already has a planned stop; the floor does not invent a dummy route.'],
      },
    ],
    actions: {
      completeDelivery: {
        label: 'Confirm delivery',
        requirement: {
          permissions: ['delivery:pod', 'orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Hidden generic action; floor uses the stage-owned handover command.'],
      },
      collectPayment: {
        label: 'Collect remaining payment',
        requirement: {
          permissions: ['orders:collect_payment'],
          requireAllPermissions: true,
        },
      },
    },
    notes: [
      ...ORDER_NOTES,
      'Matches packing/ready: WorkflowActionBar plus a stage-owned complete command.',
    ],
  },
  {
    routePattern: '/dashboard/delivery/routes/[id]',
    label: 'Delivery Route Manifest',
    page: {
      permissions: ['drivers:read', 'orders:read'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Get delivery route manifest',
        method: 'GET',
        path: '/api/v1/delivery/routes/[routeId]',
        requirement: {
          permissions: ['drivers:read', 'orders:read'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: [
      'Read-only route manifest. Completion remains server-side fail-closed until Delivery safety release gates pass.',
    ],
  },
  {
    routePattern: '/dashboard/delivery/routes/[id]/stops/[stopId]',
    label: 'Delivery Stop Detail',
    page: {
      permissions: ['drivers:read', 'orders:read'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Delivery proof and handover audit',
        method: 'GET',
        path: '/api/v1/delivery/orders/[orderId]/proof',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
        notes: ['The reusable audit card uses the order permission; the page retains its stricter driver gate.'],
      },
      {
        label: 'Get delivery stop',
        method: 'GET',
        path: '/api/v1/delivery/stops/[stopId]',
        requirement: {
          permissions: ['drivers:read', 'orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List active delivery proof methods',
        method: 'GET',
        path: '/api/v1/delivery/pod-methods',
        requirement: {
          permissions: ['delivery:pod', 'orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['OTP is excluded until its complete verification capability is released.'],
      },
      {
        label: 'Create private delivery evidence receipt',
        method: 'POST',
        path: '/api/v1/delivery/stops/[stopId]/evidence',
        requirement: {
          permissions: ['delivery:pod', 'orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Private upload receipt only; no storage URL is returned.'],
      },
      {
        label: 'Complete delivery atomically',
        method: 'POST',
        path: '/api/v1/delivery/stops/[stopId]/complete',
        requirement: {
          permissions: ['delivery:pod', 'orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Consumes tenant-stop evidence receipts with POD, stop, route, payment, and workflow checks.'],
      },
    ],
    actions: {
      completeDelivery: {
        label: 'Complete delivery with proof',
        requirement: {
          permissions: ['delivery:pod', 'orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['Atomic server command with payment and evidence receipt gates.'],
      },
    },
    notes: [
      'Stop detail owns Delivery completion. All staff writes remain fail-closed until rollout gates are explicitly enabled.',
    ],
  },
  {
    routePattern: '/dashboard/home-collection',
    label: 'Home Collection',
    page: {
      permissions: ['orders:read'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Floor worklist',
        method: 'GET',
        path: '/api/v1/orders',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
        notes: ['workflow_screen=home_collection via useScreenOrders.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/home-collection/[id]',
    label: 'Home Collection Details',
    page: {
      permissions: ['orders:read'],
      requireAllPermissions: true,
    },
    actions: {
      confirmHomeCollection: {
        label: 'Confirm collection received',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      assignHomeCollection: {
        label: 'Assign home collection',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      failHomeCollection: {
        label: 'Fail home collection',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Assign home collection',
        method: 'POST',
        path: '/api/v1/home-collection/[id]/assign',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Fail home collection',
        method: 'POST',
        path: '/api/v1/home-collection/[id]/fail',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Complete home collection (intake stamp + confirm)',
        method: 'POST',
        path: '/api/v1/home-collection/orders/[orderId]/complete',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: [
      'CONFIRM_HOME_COLLECTION uses stage-owned complete route; generic /actions is blocked for staff.',
    ],
  },
  {
    routePattern: '/dashboard/receipts/[orderId]',
    label: 'Receipt Details',
    page: {},
    apiDependencies: [
      {
        label: 'Get order',
        method: 'GET',
        path: '/api/v1/orders/[id]',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'List receipts for order',
        method: 'GET',
        path: '/api/v1/receipts/orders/[orderId]',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Create receipt for order',
        method: 'POST',
        path: '/api/v1/receipts/orders/[orderId]',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Resend receipt',
        method: 'POST',
        path: '/api/v1/receipts/[id]/resend',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: ORDER_NOTES,
  },
]

export const NEW_ORDER_ACCESS =
  ORDERS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/orders/new')!
