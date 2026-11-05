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
        label: 'Scan Resolve',
        method: 'POST',
        path: '/api/v1/scan/resolve',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Server action: list-orders',
        method: 'POST',
        path: '/app/actions/orders/list-orders',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
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
      lineDiscount: {
        label: 'Discount an order line (Line-Level P5-03c)',
        requirement: {
          permissions: ['orders:discount'],
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
        label: '[Id] Complete',
        method: 'POST',
        path: '/api/v1/assembly/[id]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Resolve',
        method: 'PATCH',
        path: '/api/v1/assembly/exceptions/[id]/resolve',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Assembly Tasks',
        method: 'POST',
        path: '/api/v1/assembly/tasks',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Tasks [TaskId]',
        method: 'GET',
        path: '/api/v1/assembly/tasks/[taskId]',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[TaskId] Complete',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/complete',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[TaskId] Exceptions',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/exceptions',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[TaskId] Pack',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/pack',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[TaskId] Qa',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/qa',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[TaskId] Scan',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/scan',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[TaskId] Start',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/start',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[OrderId] Active Stop',
        method: 'GET',
        path: '/api/v1/delivery/orders/[orderId]/active-stop',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[OrderId] Complete',
        method: 'POST',
        path: '/api/v1/delivery/orders/[orderId]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[OrderId] Proof',
        method: 'GET',
        path: '/api/v1/delivery/orders/[orderId]/proof',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Delivery Pod Methods',
        method: 'GET',
        path: '/api/v1/delivery/pod-methods',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Stops [StopId]',
        method: 'GET',
        path: '/api/v1/delivery/stops/[stopId]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[StopId] Complete',
        method: 'POST',
        path: '/api/v1/delivery/stops/[stopId]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[StopId] Evidence',
        method: 'POST',
        path: '/api/v1/delivery/stops/[stopId]/evidence',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[PaymentId] Transition',
        method: 'POST',
        path: '/api/v1/finance/pending-payments/[paymentId]/transition',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Assign',
        method: 'POST',
        path: '/api/v1/home-collection/[id]/assign',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Fail',
        method: 'POST',
        path: '/api/v1/home-collection/[id]/fail',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[OrderId] Complete',
        method: 'POST',
        path: '/api/v1/home-collection/orders/[orderId]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Lookups Issue Types',
        method: 'GET',
        path: '/api/v1/lookups/issue-types',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Lookups Priorities',
        method: 'GET',
        path: '/api/v1/lookups/priorities',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Complete',
        method: 'POST',
        path: '/api/v1/packing/[id]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[OrderId] Complete',
        method: 'POST',
        path: '/api/v1/pickup/orders/[orderId]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Complete',
        method: 'POST',
        path: '/api/v1/processing/[id]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Fail',
        method: 'POST',
        path: '/api/v1/qa/[id]/fail',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Pass',
        method: 'POST',
        path: '/api/v1/qa/[id]/pass',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Release Delivery',
        method: 'POST',
        path: '/api/v1/ready/[id]/release-delivery',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Release Pickup',
        method: 'POST',
        path: '/api/v1/ready/[id]/release-pickup',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Payments Card Brands',
        method: 'GET',
        path: '/api/v1/settings/payments/card-brands',
        requirement: {
          permissions: ['payment_config:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Payments Terminals',
        method: 'GET',
        path: '/api/v1/settings/payments/terminals',
        requirement: {
          permissions: ['payment_config:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Orders Payment Quote',
        method: 'POST',
        path: '/api/v1/orders/payment-quote',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
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
        label: 'Close wizard — count step for the linked cash drawer from Session Hub (CLF-7, CLF-8 slice A)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/close/count',
        requirement: {
          permissions: ['cash_drawer:close_session'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Close wizard — finalize the linked cash drawer from Session Hub (CLF-7, CLF-8 slice A)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/close/finalize',
        requirement: {
          permissions: ['cash_drawer:close_session'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Resume a closing drawer from Session Hub',
        method: 'GET',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/close/resume',
        requirement: {
          permissions: ['cash_drawer:close_session'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Close wizard catalogs from Session Hub (CLF-7)',
        method: 'GET',
        path: '/api/v1/cash-drawers/catalogs',
        requirement: {
          permissions: ['cash_drawer:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Session lifecycle labels (bilingual POS / drawer session statuses and events)',
        method: 'GET',
        path: '/api/v1/pos-sessions/catalogs',
        requirement: { permissions: ['pos_session:view', 'cash_drawer:view'], requireAllPermissions: false },
      },
      {
        label: 'Close wizard denomination catalog from Session Hub (CLF-7, CLF-8-1)',
        method: 'GET',
        path: '/api/v1/currencies/[code]/denominations',
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
        label: 'Cash change rounding policy for the checkout (A6-1b)',
        method: 'GET',
        path: '/api/v1/cash-drawers/rounding-policy',
        requirement: {
          permissions: ['cash_drawer:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Open cash drawer session (CLF two-step lifecycle) from Session Hub (CLF-7, CLF-8 slice A)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/open-session-v2',
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
        requirement: {
          permissions: ['orders:history'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Issue',
        method: 'POST',
        path: '/api/v1/orders/[id]/issue',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Issues list',
        method: 'GET',
        path: '/api/v1/orders/[id]/issues',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Issue summary',
        method: 'GET',
        path: '/api/v1/orders/[id]/issue-summary',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Issue resolve',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/issue/[issueId]',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Tenant issues queue',
        method: 'GET',
        path: '/api/v1/orders/issues',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
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
        requirement: {
          permissions: ['orders:split'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] State',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
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
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
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
        label: 'V1 Plan Flags',
        method: 'GET',
        path: '/api/v1/plan-flags',
        enforcement: 'auth_only',
        notes: ['Session-only: validated session (validateJWTWithTenant); reference data read by order and processing screens (BF-23).'],
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
        enforcement: 'auth_only',
        notes: ['Session-only: validated session (validateJWTWithTenant); reference data read by order and processing screens (BF-23).'],
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
        label: 'Cart quote',
        method: 'POST',
        path: '/api/v1/orders/quote',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Service speeds lookup',
        method: 'GET',
        path: '/api/v1/lookups/service-speeds',
        notes: ['Auth-only; active sys_service_speed_cd for the speed menus (Line-Level P5-03b, HQ read-only).'],
        enforcement: 'auth_only',
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
        enforcement: 'auth_only',
        notes: ['Session-only: validated session (validateJWTWithTenant); reference data read by order and processing screens (BF-23).'],
      },
      {
        label: 'List products',
        method: 'GET',
        path: '/api/v1/products',
        requirement: {
          permissions: ['products:read'],
          requireAllPermissions: true,
        },
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
        label: '[Id] Proof',
        method: 'GET',
        path: '/api/v1/delivery/orders/[id]/proof',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Transition',
        method: 'GET',
        path: '/api/v1/finance/pending-payments/[id]/transition',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Order Financial Headers (batch)',
        method: 'POST',
        path: '/api/v1/orders/financial-headers',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
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
        label: 'Server action: get-order-change-history',
        method: 'POST',
        path: '/app/actions/orders/get-order-change-history',
        requirement: {
          permissions: ['orders:read', 'orders:view_financial_breakdown'],
          requireAllPermissions: false,
        },
        notes: [
          'Order details Change History tab. Returns the change header, operations, and item/piece/preference removal lineage. Replay secrets are not selected.',
        ],
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
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Available workflow actions',
        method: 'GET',
        path: '/api/v1/orders/[id]/available-actions',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['WorkflowActionBar (new_order + order_control) on order details.'],
      },
      {
        label: 'Execute workflow action',
        method: 'POST',
        path: '/api/v1/orders/[id]/actions',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: [
          'WorkflowActionBar executeAction; Idempotency-Key required. Used for new_order and order_control.',
        ],
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
      {
        label: 'B18 — Void an order charge line',
        method: 'POST',
        path: '/api/v1/orders/[id]/charges/[chargeId]/void',
        requirement: {
          permissions: ['orders:manual_charge'],
          requireAllPermissions: true,
        },
        notes: ['Financial tab charges table Void button (reason-gated); recalculates the order snapshot in the same transaction.'],
      },
    ],
    notes: ORDER_NOTES,
    actions: {
      cancel_payment: {
        label: 'Cancel Payment',
        requirement: {
          permissions: ['orders:cancel_payment'],
          requireAllPermissions: true,
        },
      },
      fail_payment: {
        label: 'Fail Payment',
        requirement: {
          permissions: ['orders:fail_payment'],
          requireAllPermissions: true,
        },
      },
      manual_charge: {
        label: 'Manual Charge',
        requirement: {
          permissions: ['orders:manual_charge'],
          requireAllPermissions: true,
        },
      },
      process_refund: {
        label: 'Process Refund',
        requirement: {
          permissions: ['orders:process_refund'],
          requireAllPermissions: true,
        },
      },
      read: {
        label: 'Read',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
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
      voidCharge: {
        label: 'B18 — Void an order charge line',
        requirement: {
          permissions: ['orders:manual_charge'],
          requireAllPermissions: true,
        },
      },
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
      initiateRefundAndRebill: {
        label: 'Initiate refund-and-rebill context (Financial tab dialog)',
        requirement: {
          permissions: ['orders:rebill_authorize'],
          requireAllPermissions: true,
          featureFlags: ['order_fin_refund_ui'],
          requireAllFeatureFlags: true,
        },
        notes: [
          'Shown in the initiate-refund context picker only when orders:rebill_authorize is held. Reopens due by the refunded amount.',
        ],
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
      newOrderActions: {
        label: 'New order actions (screen new_order)',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: [
          'WorkflowActionBar screen=new_order hideWhenEmpty. Engine lists every new_order edge for the pinned current status. Not the remote pending_dropoff confirm-physical-intake API.',
        ],
      },
      orderControlActions: {
        label: 'Order actions (screen order_control)',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: [
          'WorkflowActionBar screen=order_control hideWhenEmpty. Engine lists hold / resume / stop for the pinned current status.',
        ],
      },
    },
},
  {
    routePattern: '/dashboard/orders/[id]/edit',
    label: 'Edit Order',
    page: {},
    apiDependencies: [
      {
        label: 'Orders Payment Quote',
        method: 'POST',
        path: '/api/v1/orders/payment-quote',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order Change Preview',
        method: 'POST',
        path: '/api/v1/orders/[id]/changes/preview',
        requirement: {
          permissions: ['orders:edit'],
          requireAllPermissions: true,
        },
        notes: ['Read-only Edit preview. CSRF and orders:edit are enforced in the route. No Change row is written.'],
      },
      {
        label: 'Order Change Quote (live card)',
        method: 'POST',
        path: '/api/v1/orders/[id]/changes/quote',
        requirement: {
          permissions: ['orders:edit'],
          requireAllPermissions: true,
        },
        notes: ['Reusable Order Fin View P4-08: same calculation as Preview, no review proof, nothing written. CSRF, edit session and a per-user rate limit are enforced in the route.'],
      },
      {
        label: 'Order Edit session',
        method: 'POST',
        path: '/api/v1/orders/[id]/edit-session',
        requirement: {
          permissions: ['orders:edit'],
          requireAllPermissions: true,
        },
        notes: ['Starts, claims, refreshes, or ends the tab edit lock. CSRF and orders:edit are enforced. A copied edit address has no session.'],
      },
      {
        label: 'Order Change Context',
        method: 'GET',
        path: '/api/v1/orders/[id]/change-context',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
        notes: ['Authoritative Edit facts for the workspace. orders:read is enforced in the route. The deferred feature flag inside the payload is not the live gate.'],
      },
      {
        label: 'Order Change Apply',
        method: 'POST',
        path: '/api/v1/orders/[id]/changes',
        requirement: {
          permissions: ['orders:edit'],
          requireAllPermissions: true,
        },
        notes: ['Atomic Edit apply. CSRF, Idempotency-Key, and orders:edit are enforced in the route. One Change commits or the transaction rolls back.'],
      },
      {
        label: 'Order Change History',
        method: 'GET',
        path: '/api/v1/orders/[id]/changes',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
        notes: ['Applied Change labels for this order. orders:read is enforced. Financial snapshots are not returned.'],
      },
      {
        label: 'Order Change Follow-up',
        method: 'GET',
        path: '/api/v1/orders/[id]/changes/follow-up',
        requirement: {
          permissions: ['orders:edit'],
          requireAllPermissions: true,
        },
        notes: ['Read-only follow-up plan after a committed Change. orders:edit is enforced. It does not collect or refund.'],
      },
      {
        label: 'Order Change Stored-value Resolution',
        method: 'POST',
        path: '/api/v1/orders/[id]/financial-resolution',
        requirement: {
          permissions: ['orders:overpayment_allocate'],
          requireAllPermissions: true,
        },
        notes: ['Moves an existing overpayment to customer advance, credit, or wallet through the disposition owner. CSRF and orders:overpayment_allocate are enforced. Cash and gateway refunds are rejected.'],
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
        label: 'V1 Categories',
        method: 'GET',
        path: '/api/v1/categories',
        enforcement: 'auth_only',
        notes: ['Session-only: validated session (validateJWTWithTenant); reference data read by order and processing screens (BF-23).'],
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
        label: 'Orders Preview Payment',
        method: 'POST',
        path: '/api/v1/orders/preview-payment',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Service speeds lookup',
        method: 'GET',
        path: '/api/v1/lookups/service-speeds',
        notes: ['Auth-only; active sys_service_speed_cd for the speed menus (Line-Level P5-03b, HQ read-only).'],
        enforcement: 'auth_only',
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
        enforcement: 'auth_only',
        notes: ['Session-only: validated session (validateJWTWithTenant); reference data read by order and processing screens (BF-23).'],
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
        enforcement: 'auth_only',
        notes: ['Session-only: validated session (validateJWTWithTenant); reference data read by order and processing screens (BF-23).'],
      },
      {
        label: 'V1 Products',
        method: 'GET',
        path: '/api/v1/products',
        requirement: {
          permissions: ['products:read'],
          requireAllPermissions: true,
        },
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
    page: {
      permissions: ['orders:read'],
      requireAllPermissions: true,},
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
        label: '[Id] Batch Update',
        method: 'POST',
        path: '/api/v1/orders/[id]/batch-update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Void',
        method: 'GET',
        path: '/api/v1/orders/[id]/charges/[id]/void',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Edit Session',
        method: 'POST',
        path: '/api/v1/orders/[id]/edit-session',
        requirement: {
          permissions: ['orders:edit'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order Financial View',
        method: 'GET',
        path: '/api/v1/orders/[id]/financial-view',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Rack Bags',
        method: 'GET',
        path: '/api/v1/orders/[id]/rack-bags',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order Financial Headers (batch)',
        method: 'POST',
        path: '/api/v1/orders/financial-headers',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
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
        label: '[Id] Confirm Physical Intake',
        method: 'POST',
        path: '/api/v1/orders/[id]/confirm-physical-intake',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: [
          'Remote booking drop-off banner only (draft + pending_dropoff). Received bags use WorkflowActionBar screen=new_order.',
        ],
      },
      {
        label: 'Available workflow actions',
        method: 'GET',
        path: '/api/v1/orders/[id]/available-actions',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['WorkflowActionBar (new_order + order_control) on full order details.'],
      },
      {
        label: 'Execute workflow action',
        method: 'POST',
        path: '/api/v1/orders/[id]/actions',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: [
          'WorkflowActionBar executeAction; Idempotency-Key required. Used for new_order and order_control.',
        ],
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
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Transitions',
        method: 'GET',
        path: '/api/v1/orders/[id]/transitions',
        requirement: {
          permissions: ['orders:read'],
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
        label: 'Server action: get-order-change-history',
        method: 'POST',
        path: '/app/actions/orders/get-order-change-history',
        requirement: {
          permissions: ['orders:read', 'orders:view_financial_breakdown'],
          requireAllPermissions: false,
        },
        notes: [
          'Order details Change History tab. Returns the change header, operations, and item/piece/preference removal lineage. Replay secrets are not selected.',
        ],
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
        label: 'B18 — Void an order charge line',
        method: 'POST',
        path: '/api/v1/orders/[id]/charges/[chargeId]/void',
        requirement: {
          permissions: ['orders:manual_charge'],
          requireAllPermissions: true,
        },
        notes: ['Financial tab charges table Void button (reason-gated); recalculates the order snapshot in the same transaction.'],
      },
    ],
    actions: {
      manual_charge: {
        label: 'Manual Charge',
        requirement: {
          permissions: ['orders:manual_charge'],
          requireAllPermissions: true,
        },
      },
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
      voidCharge: {
        label: 'B18 — Void an order charge line',
        requirement: {
          permissions: ['orders:manual_charge'],
          requireAllPermissions: true,
        },
      },
      newOrderActions: {
        label: 'New order actions (screen new_order)',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: [
          'WorkflowActionBar screen=new_order hideWhenEmpty. Engine lists every new_order edge for the pinned current status.',
        ],
      },
      orderControlActions: {
        label: 'Order actions (screen order_control)',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: [
          'WorkflowActionBar screen=order_control hideWhenEmpty. Engine lists hold / resume / stop for the pinned current status.',
        ],
      },
    },
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
      read: {
        label: 'Read',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
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
      editOrder: {
        label: 'Edit Order',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
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
        label: '[Id] Edit Session',
        method: 'POST',
        path: '/api/v1/orders/[id]/edit-session',
        requirement: {
          permissions: ['orders:edit'],
          requireAllPermissions: true,
        },
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
        label: '[Id] Rack Bags',
        method: 'GET',
        path: '/api/v1/orders/[id]/rack-bags',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
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
        label: 'Issue [Id]',
        method: 'GET',
        path: '/api/v1/orders/[id]/issue/[id]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Tenant issues queue',
        method: 'GET',
        path: '/api/v1/orders/issues',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Resolve issue',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/issue/[issueId]',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
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
    actions: {
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
    routePattern: '/dashboard/processing',
    label: 'Processing',
    page: {},
    apiDependencies: [
      {
        label: 'Lookups Issue Types',
        method: 'GET',
        path: '/api/v1/lookups/issue-types',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Lookups Priorities',
        method: 'GET',
        path: '/api/v1/lookups/priorities',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
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
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
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
        requirement: {
          permissions: ['orders:split'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Report issue (Simple Processing)',
        method: 'POST',
        path: '/api/v1/orders/[id]/issue',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
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
        label: '[Id] Conditions',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/[id]/conditions',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Service Prefs',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/[id]/service-prefs',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Pieces Scan',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/scan',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Step',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/step',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Rack Bags',
        method: 'GET',
        path: '/api/v1/orders/[id]/rack-bags',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Processing steps',
        method: 'GET',
        path: '/api/v1/processing-steps/[category]',
        enforcement: 'auth_only',
        notes: ['Session-only: validated session (validateJWTWithTenant); reference data read by order and processing screens (BF-23).'],
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
        requirement: {
          permissions: ['orders:split'],
          requireAllPermissions: true,
        },
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
        label: 'Assembly Tasks',
        method: 'POST',
        path: '/api/v1/assembly/tasks',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Tasks [Id]',
        method: 'GET',
        path: '/api/v1/assembly/tasks/[id]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Complete',
        method: 'GET',
        path: '/api/v1/assembly/tasks/[id]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Exceptions',
        method: 'GET',
        path: '/api/v1/assembly/tasks/[id]/exceptions',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Pack',
        method: 'GET',
        path: '/api/v1/assembly/tasks/[id]/pack',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Qa',
        method: 'GET',
        path: '/api/v1/assembly/tasks/[id]/qa',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Scan',
        method: 'GET',
        path: '/api/v1/assembly/tasks/[id]/scan',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Start',
        method: 'GET',
        path: '/api/v1/assembly/tasks/[id]/start',
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
        label: '[Id] Conditions',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/[id]/conditions',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Service Prefs',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/[id]/service-prefs',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Pieces Scan',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/scan',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Rack Bags',
        method: 'GET',
        path: '/api/v1/orders/[id]/rack-bags',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
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
        label: '[Id] Batch Update',
        method: 'POST',
        path: '/api/v1/orders/[id]/batch-update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
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
        label: '[Id] Conditions',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/[id]/conditions',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Service Prefs',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/[id]/service-prefs',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Pieces Scan',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/scan',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Rack Bags',
        method: 'GET',
        path: '/api/v1/orders/[id]/rack-bags',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create issue',
        method: 'POST',
        path: '/api/v1/orders/[id]/issue',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
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
    routePattern: '/dashboard/ready/[id]/print/[type]',
    label: 'Print Ready Document',
    page: {},
    apiDependencies: [
      {
        label: '[Id] Discounts',
        method: 'GET',
        path: '/api/v1/orders/[id]/discounts',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order Financial View',
        method: 'GET',
        path: '/api/v1/orders/[id]/financial-view',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Label Data',
        method: 'GET',
        path: '/api/v1/orders/[id]/label-data',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '{OrderId} State',
        method: 'GET',
        path: '/api/v1/orders/{orderId}/state',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Order Financial Headers (batch)',
        method: 'POST',
        path: '/api/v1/orders/financial-headers',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order history',
        method: 'GET',
        path: '/api/v1/orders/[id]/history',
        requirement: {
          permissions: ['orders:history'],
          requireAllPermissions: true,
        },
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
        label: '[Id] Conditions',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/[id]/conditions',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Service Prefs',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/[id]/service-prefs',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Pieces Scan',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[id]/pieces/scan',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Rack Bags',
        method: 'GET',
        path: '/api/v1/orders/[id]/rack-bags',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
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
    routePattern: '/dashboard/home-collection/[id]',
    label: 'Home Collection Details',
    page: {
      permissions: ['orders:read'],
      requireAllPermissions: true,
    },
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
        label: '[Id] Complete',
        method: 'GET',
        path: '/api/v1/home-collection/orders/[id]/complete',
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
        label: '[Id] Rack Bags',
        method: 'GET',
        path: '/api/v1/orders/[id]/rack-bags',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
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
        label: 'Orders [Id]',
        method: 'GET',
        path: '/api/v1/receipts/orders/[id]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
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

  {
    routePattern: '/dashboard/orders/[id]/tax-documents/[documentId]/print',
    label: 'Print Tax Document',
    page: {
      permissions: ['orders:view_financial_breakdown'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: '[Id] Print',
        method: 'GET',
        path: '/api/v1/orders/[id]/tax-documents/[id]/print',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Print tax document',
        method: 'GET',
        path: '/api/v1/orders/[id]/tax-documents/[documentId]/print',
        requirement: {
          permissions: ['orders:view_financial_breakdown'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['B14 follow-up — printable bilingual fiscal tax document report route.'],
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
      read: {
        label: 'Read',
        requirement: {
          permissions: ['orders:read'],
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
    routePattern: '/dashboard/orders/[id]/workspace',
    label: 'Workspace',
    page: {
      permissions: ['orders:view_financial_breakdown'],
      requireAllPermissions: true,
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
        label: '[Id] Complete',
        method: 'POST',
        path: '/api/v1/assembly/[id]/complete',
        notes: [
      '[derive] page.permissions conflict — review manually. Contract only: [orders:view_financial_breakdown]. Code only: [orders:read].','Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Assembly Dashboard',
        method: 'GET',
        path: '/api/v1/assembly/dashboard',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Resolve',
        method: 'PATCH',
        path: '/api/v1/assembly/exceptions/[id]/resolve',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Assembly Tasks',
        method: 'POST',
        path: '/api/v1/assembly/tasks',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Tasks [TaskId]',
        method: 'GET',
        path: '/api/v1/assembly/tasks/[taskId]',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[TaskId] Complete',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/complete',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[TaskId] Exceptions',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/exceptions',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[TaskId] Pack',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/pack',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[TaskId] Qa',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/qa',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[TaskId] Scan',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/scan',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[TaskId] Start',
        method: 'POST',
        path: '/api/v1/assembly/tasks/[taskId]/start',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
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
          permissions: ['products:categories'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Code] Denominations',
        method: 'GET',
        path: '/api/v1/currencies/[code]/denominations',
        requirement: {
          permissions: ['cash_drawer:view'],
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
        label: '[OrderId] Active Stop',
        method: 'GET',
        path: '/api/v1/delivery/orders/[orderId]/active-stop',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[OrderId] Complete',
        method: 'POST',
        path: '/api/v1/delivery/orders/[orderId]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[OrderId] Proof',
        method: 'GET',
        path: '/api/v1/delivery/orders/[orderId]/proof',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Delivery Pod Methods',
        method: 'GET',
        path: '/api/v1/delivery/pod-methods',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
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
        label: 'Routes [RouteId]',
        method: 'GET',
        path: '/api/v1/delivery/routes/[routeId]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Stops [StopId]',
        method: 'GET',
        path: '/api/v1/delivery/stops/[stopId]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[StopId] Complete',
        method: 'POST',
        path: '/api/v1/delivery/stops/[stopId]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[StopId] Evidence',
        method: 'POST',
        path: '/api/v1/delivery/stops/[stopId]/evidence',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[PaymentId] Transition',
        method: 'POST',
        path: '/api/v1/finance/pending-payments/[paymentId]/transition',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Assign',
        method: 'POST',
        path: '/api/v1/home-collection/[id]/assign',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Fail',
        method: 'POST',
        path: '/api/v1/home-collection/[id]/fail',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[OrderId] Complete',
        method: 'POST',
        path: '/api/v1/home-collection/orders/[orderId]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Lookups Issue Types',
        method: 'GET',
        path: '/api/v1/lookups/issue-types',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Lookups Priorities',
        method: 'GET',
        path: '/api/v1/lookups/priorities',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Lookups Service Speeds',
        method: 'GET',
        path: '/api/v1/lookups/service-speeds',
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
        label: '[Id] Change Context',
        method: 'GET',
        path: '/api/v1/orders/[id]/change-context',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Changes',
        method: 'GET',
        path: '/api/v1/orders/[id]/changes',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Changes Follow Up',
        method: 'GET',
        path: '/api/v1/orders/[id]/changes/follow-up',
        requirement: {
          permissions: ['orders:edit'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Changes Preview',
        method: 'POST',
        path: '/api/v1/orders/[id]/changes/preview',
        requirement: {
          permissions: ['orders:edit'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[ChargeId] Void',
        method: 'POST',
        path: '/api/v1/orders/[id]/charges/[chargeId]/void',
        requirement: {
          permissions: ['orders:manual_charge'],
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
        label: '[Id] Edit Session',
        method: 'POST',
        path: '/api/v1/orders/[id]/edit-session',
        requirement: {
          permissions: ['orders:edit'],
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
        label: '[Id] Financial Resolution',
        method: 'POST',
        path: '/api/v1/orders/[id]/financial-resolution',
        requirement: {
          permissions: ['orders:overpayment_allocate'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Order Financial View',
        method: 'GET',
        path: '/api/v1/orders/[id]/financial-view',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Fix Order Data',
        method: 'POST',
        path: '/api/v1/orders/[id]/fix-order-data',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] History',
        method: 'GET',
        path: '/api/v1/orders/[id]/history',
        requirement: {
          permissions: ['orders:history'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Issue',
        method: 'POST',
        path: '/api/v1/orders/[id]/issue',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Issue Summary',
        method: 'GET',
        path: '/api/v1/orders/[id]/issue-summary',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Issue [IssueId]',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/issue/[issueId]',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Issues',
        method: 'GET',
        path: '/api/v1/orders/[id]/issues',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
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
        label: '[PieceId] Preferences',
        method: 'GET',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/preferences',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Preferences [PrefId]',
        method: 'DELETE',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/preferences/[prefId]',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[PrefId] Notes',
        method: 'POST',
        path: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/preferences/[prefId]/notes',
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
        label: '[Id] Rack Bags',
        method: 'GET',
        path: '/api/v1/orders/[id]/rack-bags',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Refunds',
        method: 'GET',
        path: '/api/v1/orders/[id]/refunds',
        requirement: {
          permissions: ['orders:view_financial_breakdown'],
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
        requirement: {
          permissions: ['orders:split'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[DocumentId] Print',
        method: 'GET',
        path: '/api/v1/orders/[id]/tax-documents/[documentId]/print',
        requirement: {
          permissions: ['orders:view_financial_breakdown'],
          requireAllPermissions: true,
        },
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
        label: '[Id] Transitions',
        method: 'GET',
        path: '/api/v1/orders/[id]/transitions',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
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
        label: 'Order Financial Headers (batch)',
        method: 'POST',
        path: '/api/v1/orders/financial-headers',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Orders Issues',
        method: 'GET',
        path: '/api/v1/orders/issues',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Orders Payment Quote',
        method: 'POST',
        path: '/api/v1/orders/payment-quote',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
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
        label: 'Orders Quote',
        method: 'POST',
        path: '/api/v1/orders/quote',
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
        label: '[Id] Complete',
        method: 'POST',
        path: '/api/v1/packing/[id]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[OrderId] Complete',
        method: 'POST',
        path: '/api/v1/pickup/orders/[orderId]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'V1 Plan Flags',
        method: 'GET',
        path: '/api/v1/plan-flags',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[SessionId] Summary',
        method: 'GET',
        path: '/api/v1/pos-sessions/[sessionId]/summary',
        requirement: {
          permissions: ['pos_session:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Pos Sessions Auto Link Drawer',
        method: 'POST',
        path: '/api/v1/pos-sessions/auto-link-drawer',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Pos Sessions Catalogs',
        method: 'GET',
        path: '/api/v1/pos-sessions/catalogs',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'Pos Sessions Close',
        method: 'POST',
        path: '/api/v1/pos-sessions/close',
        requirement: {
          permissions: ['pos_session:close'],
          requireAllPermissions: true,
        },
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
        label: 'Pos Sessions Force Close',
        method: 'POST',
        path: '/api/v1/pos-sessions/force-close',
        requirement: {
          permissions: ['pos_session:force_close'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Pos Sessions Pause',
        method: 'POST',
        path: '/api/v1/pos-sessions/pause',
        requirement: {
          permissions: ['pos_session:pause_resume'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Pos Sessions Resume',
        method: 'POST',
        path: '/api/v1/pos-sessions/resume',
        requirement: {
          permissions: ['pos_session:pause_resume'],
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
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
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
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Processing Steps [Category]',
        method: 'GET',
        path: '/api/v1/processing-steps/[category]',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Complete',
        method: 'POST',
        path: '/api/v1/processing/[id]/complete',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'V1 Products',
        method: 'GET',
        path: '/api/v1/products',
        requirement: {
          permissions: ['products:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Fail',
        method: 'POST',
        path: '/api/v1/qa/[id]/fail',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Pass',
        method: 'POST',
        path: '/api/v1/qa/[id]/pass',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Release Delivery',
        method: 'POST',
        path: '/api/v1/ready/[id]/release-delivery',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: '[Id] Release Pickup',
        method: 'POST',
        path: '/api/v1/ready/[id]/release-pickup',
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
        label: 'V1 Cash Drawers',
        method: 'GET',
        path: '/api/v1/cash-drawers',
        requirement: {
          permissions: ['cash_drawer:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Cash change rounding policy for the checkout (A6-1b)',
        method: 'GET',
        path: '/api/v1/cash-drawers/rounding-policy',
        requirement: {
          permissions: ['cash_drawer:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Payments',
        method: 'POST',
        path: '/api/v1/orders/[id]/payments',
        requirement: {
          permissions: ['orders:collect_payment'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] State',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        requirement: {
          permissions: ['orders:read'],
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
        label: 'Payments Card Brands',
        method: 'GET',
        path: '/api/v1/settings/payments/card-brands',
        requirement: {
          permissions: ['payment_config:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Payments Terminals',
        method: 'GET',
        path: '/api/v1/settings/payments/terminals',
        requirement: {
          permissions: ['payment_config:view'],
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
        label: 'Available workflow actions',
        method: 'GET',
        path: '/api/v1/orders/[id]/available-actions',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: ['WorkflowActionBar (new_order + order_control) on workspace Actions.'],
      },
      {
        label: 'Execute workflow action',
        method: 'POST',
        path: '/api/v1/orders/[id]/actions',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: [
          'WorkflowActionBar executeAction; Idempotency-Key required. Used for new_order and order_control.',
        ],
      },
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
      newOrderActions: {
        label: 'New order actions (screen new_order)',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: [
          'WorkflowActionBar screen=new_order hideWhenEmpty. Engine lists every new_order edge for the pinned current status.',
        ],
      },
      orderControlActions: {
        label: 'Order actions (screen order_control)',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
        notes: [
          'WorkflowActionBar screen=order_control hideWhenEmpty. Engine lists hold / resume / stop for the pinned current status.',
        ],
      },
    },
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
        label: 'Order Financial View',
        method: 'GET',
        path: '/api/v1/orders/[id]/financial-view',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
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
        label: 'Order Financial View',
        method: 'GET',
        path: '/api/v1/orders/[id]/financial-view',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
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
];

export const NEW_ORDER_ACCESS =
  ORDERS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/orders/new')!
export const ORDERS_ORDERS_WORKSPACE_ACCESS =
  ORDERS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/orders/[id]/workspace')!
