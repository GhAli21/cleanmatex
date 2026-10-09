/**
 * Navigation types and path helpers.
 * The live sidebar is sys_components_cd, not NAVIGATION_SECTIONS.
 * A database row shows even when it is absent from this file.
 */

import type { LucideIcon } from 'lucide-react'
import { FLAG_KEYS } from '@/lib/constants/feature-flags'
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions/admin-perm'
import {
  Home,
  PackageSearch,
  ScanBarcode,
  Truck,
  PackageCheck,
  Users,
  Tags,
  BarChart3,
  Boxes,
  Landmark,
  LifeBuoy,
  ClipboardCheck,
  Settings2,
  CheckCircle,
  CircleCheck,
  Bug,
  Building2,
  FileText,
  Megaphone,
  Wallet,
  RotateCcw,
  Star,
  Tag,
  Calculator,
  BookOpen,
  FilePlus,
  Bell,
} from 'lucide-react'

/** `none` = placeholder sections with no role gate (permissions-only). */
export type UserRole =
  // System roles (seeded in 0035 + admin)
  | 'super_admin' | 'tenant_admin' | 'admin' | 'branch_manager' | 'operator'
  // Operational roles (seeded in 0374)
  | 'accountant' | 'b2b_customer' | 'cashier' | 'driver' | 'finance_manager'
  | 'it_support' | 'laundry_worker' | 'presser' | 'qa_inspector' | 'receptionist'
  | 'route_supervisor' | 'store_keeper' | 'supervisor'
  // Read-only / placeholder
  | 'viewer' | 'none'

/**
 *
 */
export interface NavigationSection {
  key: string
  label: string
  label2?: string  // Arabic label from DB (sys_components_cd.label2)
  icon: LucideIcon
  path: string
  roles?: UserRole[]  // Optional: role-based access (fallback)
  permissions?: string[]  // Optional: permission-based access (e.g., ['orders:read'])
  requireAllPermissions?: boolean  // If true, require ALL permissions; if false, require ANY
  featureFlag?: string
  badge?: string
  children?: NavigationItem[]
}

/**
 *
 */
export interface NavigationItem {
  key: string
  label: string
  label2?: string  // Arabic label from DB (sys_components_cd.label2)
  path: string
  roles?: UserRole[]  // Optional: role-based access
  permissions?: string[]  // Optional: permission-based access
  requireAllPermissions?: boolean  // If true, require ALL permissions; if false, require ANY
  featureFlag?: string
}

/**
 * Not read by the sidebar. Kept for types and local helpers.
 * Menu rows live in sys_components_cd.
 */
export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    key: 'home',
    label: 'Dashboard',
    icon: Home,
    path: '/dashboard',
    roles: ['super_admin', 'tenant_admin', 'admin', 'operator', 'viewer'],
  },

  {
    key: 'orders',
    label: 'Orders',
    icon: PackageSearch,
    path: '/dashboard/orders',
    roles: ['super_admin', 'tenant_admin', 'admin', 'operator', 'viewer'],
    permissions: ['orders:read'],
    children: [
      {
        key: 'orders_list',
        label: 'All Orders',
        path: '/dashboard/orders',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
        permissions: ['orders:read'],
      },
      {
        key: 'orders_workboard',
        label: 'Workboard',
        label2: 'لوحة العمل',
        path: '/dashboard/workboard',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'supervisor'],
        permissions: ['workboard:read'],
      },
      /*
      TESTING:
      do this if I decide to add three new screens in the navigation tree using the command:
      /navigation /create-ui-screen-in-sys-tree add three new screens thier parent code "orders" and display_order=1 and labels are All Orders TEST1 to All Orders TEST3 and paths are /dashboard/orders/test1 /dashboard/orders/test2 /dashboard/orders/test3
      {
        key: 'orders_list',
        label: 'All Orders TEST1',
        path: '/dashboard/orders',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
      },
      {
        key: 'orders_list',
        label: 'All Orders TEST2',
        path: '/dashboard/orders',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
      },
      {
        key: 'orders_list',
        label: 'All Orders TEST3',
        path: '/dashboard/orders',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
      },
      */
      {
        key: 'orders_new',
        label: 'New Order',
        path: '/dashboard/orders/new',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
        permissions: ['orders:create'],
      },
      {
        key: 'orders_preparation',
        label: 'Preparation',
        path: '/dashboard/preparation',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
        permissions: ['orders:read'],
      },
      {
        key: 'orders_home_collection',
        label: 'Home Collection',
        path: '/dashboard/home-collection',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
        permissions: ['orders:read'],
      },
      {
        key: 'orders_processing',
        label: 'Processing',
        path: '/dashboard/processing',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
        permissions: ['orders:read'],
      },
      {
        key: 'orders_issues',
        label: 'Issues',
        path: '/dashboard/issues',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator', 'viewer'],
        permissions: ['orders:read'],
      },
      {
        key: 'orders_assembly',
        label: 'Assembly',
        path: '/dashboard/assembly',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
        permissions: ['orders:read'],
      },
      {
        key: 'orders_qa',
        label: 'Quality Check',
        path: '/dashboard/qa',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
        permissions: ['orders:read'],
      },
      {
        key: 'orders_ready',
        label: 'Ready',
        path: '/dashboard/ready',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
        permissions: ['orders:read'],
      },
      {
        key: 'orders_packing',
        label: 'Packing',
        path: '/dashboard/packing',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
        permissions: ['orders:read'],
      },
      {
        key: 'orders_delivery',
        label: 'Delivery',
        path: '/dashboard/delivery',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
        permissions: ['orders:read'],
      },
    ],
  },

  {
    key: 'assembly',
    label: 'AssemblyJh',
    icon: ScanBarcode,
    path: '/dashboard/assembly',
    //roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
    roles: ['none'],
    permissions: ['orders:read'],
  },

  {
    key: 'drivers',
    label: 'Drivers & Routes',
    icon: Truck,
    path: '/dashboard/drivers',
    roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
    permissions: ['drivers:read'],
    children: [
      {
        key: 'drivers_list',
        label: 'All Drivers',
        path: '/dashboard/drivers',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        permissions: ['drivers:read'],
      },
      {
        key: 'drivers_routes',
        label: 'Routes',
        path: '/dashboard/drivers/routes',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        permissions: ['drivers:read', 'orders:read'],
      },
    ],
  },
  {
    key: 'delivery',
    label: 'Delivery',
    icon: Truck,
    path: '/dashboard/delivery',
    roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
    permissions: ['orders:read'],
  },
  {
    key: 'users',
    label: 'Team Members',
    icon: Users,
    path: '/dashboard/users',
    roles: ['admin', 'super_admin', 'tenant_admin'],
    permissions: ['users:read'],
    children: [
      {
        key: 'users_list',
        label: 'All Users',
        path: '/dashboard/users',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['users:read'],
      },
      {
        key: 'users_sessions',
        label: 'Active Sessions',
        label2: 'الجلسات النشطة',
        path: '/dashboard/users/sessions',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['user_sessions:read'],
      },
    ],
  },
  {
    key: 'customers',
    label: 'Customer Management',
    icon: Users,
    path: '/dashboard/customers',
    roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator', 'viewer'],
    permissions: ['customers:read'],
    children: [
      {
        key: 'customers_list',
        label: 'All Customers',
        path: '/dashboard/customers',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator', 'viewer'],
        permissions: ['customers:read'],
      },
      {
        key: 'customers_stored_value',
        label: 'Stored Value',
        label2: 'القيمة المخزنة',
        path: '/dashboard/customers/stored-value',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator'],
        permissions: ['stored_value:view_balances'],
      },
      {
        key: 'customers_account_receipt',
        label: 'Account Receipt',
        label2: 'قبض حساب',
        path: '/dashboard/customers/account-receipt',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'cashier'],
        permissions: ['customers:receipt_allocate'],
      },
    ],
  },
  {
    key: 'b2b',
    label: 'B2B',
    icon: Building2,
    path: '/dashboard/b2b/customers',
    roles: ['admin', 'super_admin', 'tenant_admin'],
    permissions: ['b2b_customers:view'],
    //featureFlag: 'b2b_contracts',
    children: [
      {
        key: 'b2b_customers',
        label: 'B2B Customers',
        path: '/dashboard/b2b/customers',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['b2b_customers:view'],
        //featureFlag: 'b2b_contracts',
      },
      {
        key: 'b2b_contracts',
        label: 'Contracts',
        path: '/dashboard/b2b/contracts',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['b2b_contracts:view'],
        //featureFlag: 'b2b_contracts',
      },
      {
        key: 'b2b_statements',
        label: 'Statements',
        path: '/dashboard/b2b/statements',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['b2b_statements:view'],
        //featureFlag: 'b2b_contracts',
      },
    ],
  },
  {
    key: 'catalog',
    label: 'Catalog & Pricing',
    icon: Tags,
    path: '/dashboard/catalog',
    roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
    permissions: [ADMIN_PERMISSIONS.MANAGE],
    children: [
      {
        key: 'catalog_services',
        label: 'Services',
        path: '/dashboard/catalog/services',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        permissions: [ADMIN_PERMISSIONS.MANAGE],
      },
      {
        key: 'catalog_pricing',
        label: 'Pricing',
        path: '/dashboard/catalog/pricing',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        permissions: [ADMIN_PERMISSIONS.MANAGE],
      },
      {
        key: 'catalog_addons',
        label: 'Add-ons',
        path: '/dashboard/catalog/addons',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        permissions: [ADMIN_PERMISSIONS.MANAGE],
      },
      {
        key: 'catalog_preferences',
        label: 'Services preferences',
        path: '/dashboard/catalog/preferences',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        permissions: ['config:preferences_manage'],
      },
      {
        key: 'catalog_order_sources',
        label: 'Order channels',
        path: '/dashboard/catalog/order-sources',
        roles: ['super_admin', 'tenant_admin'],
        permissions: ['config:preferences_manage'],
      },
      {
        key: 'catalog_customer_categories',
        label: 'Customer Categories',
        path: '/dashboard/catalog/customer-categories',
        roles: ['super_admin', 'tenant_admin'],
        permissions: ['config:preferences_manage'],
      },
    ],
  },
  {
    key: 'internal_fin',
    label: 'Internal Finance And Operations',
    label2: 'المالية الداخلية والتشغيل',
    icon: BookOpen,
    path: '/dashboard/internal_fin',
    roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator', 'cashier'],
    children: [
      {
        key: 'billing_invoices',
        label: 'Invoices',
        path: '/dashboard/internal_fin/invoices',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
        permissions: ['invoices:read'],
      },
      {
        key: 'billing_invoices_new',
        label: 'New AR Invoice',
        label2: 'فاتورة مدينة جديدة',
        path: '/dashboard/internal_fin/invoices/new',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
        permissions: ['invoices:create'],
      },
      {
        key: 'billing_ar_aging',
        label: 'AR Aging',
        label2: 'أعمار الذمم المدينة',
        path: '/dashboard/internal_fin/ar/aging',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator'],
        permissions: ['ar_aging:view'],
      },
      {
        key: 'billing_ar_balances',
        label: 'Customer Balances',
        label2: 'أرصدة العملاء',
        path: '/dashboard/internal_fin/ar/customers',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator'],
        permissions: ['ar_ledger:view'],
      },
      {
        key: 'billing_ar_ledger',
        label: 'AR Ledger',
        label2: 'دفتر الذمم المدينة',
        path: '/dashboard/internal_fin/ar/ledger',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator'],
        permissions: ['ar_ledger:view'],
      },
      {
        key: 'billing_ar_statements',
        label: 'Customer Statements',
        label2: 'كشوف حساب العملاء',
        path: '/dashboard/internal_fin/ar/statements',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator'],
        permissions: ['customer_statements:view'],
      },
      {
        key: 'billing_ar_credits',
        label: 'AR Credits',
        label2: 'أرصدة الذمم',
        path: '/dashboard/internal_fin/ar/credits',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator'],
        permissions: ['ar_credits:view'],
      },
      {
        key: 'billing_ar_disputes',
        label: 'AR Disputes',
        label2: 'نزاعات الذمم',
        path: '/dashboard/internal_fin/ar/disputes',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator'],
        permissions: ['ar_disputes:view'],
      },
      {
        key: 'billing_ar_dunning',
        label: 'AR Dunning',
        label2: 'تحصيل الذمم',
        path: '/dashboard/internal_fin/ar/dunning',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator'],
        permissions: ['ar_dunning:view'],
      },
      {
        key: 'billing_ar_cycles',
        label: 'Statement Cycles',
        label2: 'دورات الكشوف',
        path: '/dashboard/internal_fin/ar/cycles',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator'],
        permissions: ['ar_stmt_cycles:view'],
      },
      {
        key: 'billing_vouchers',
        label: 'Receipt Vouchers',
        path: '/dashboard/internal_fin/vouchers',
        roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
        // Mirrors the page contract gate (vouchers-access.ts) — users without
        // it are blocked at page level, so the sidebar hides it too.
        permissions: ['fin_vouchers:view'],
      },
      // 'billing_payments' removed (Order-Fin remediation Phase 3): the
      // internal_fin/payments screens operated on the deprecated
      // legacy payments ledger (ADR-002). Dual-write: sys_components_cd
      // row removed by migration 0393.
      // 'billing_cashup' removed (Order-Fin remediation Phase 5): superseded
      // by cash drawer sessions + the D-09 reconciliation report (FN-06).
      // Dual-write: sys_components_cd row retired by migration 0394.
      {
        key: 'billing_cash_drawers',
        label: 'Cash Drawers',
        label2: 'أدراج النقد',
        path: '/dashboard/internal_fin/cash-drawers',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator'],
        permissions: ['cash_drawer:view'],
      },
      {
        key: 'billing_cash_drawer_followup',
        label: 'Cash Deposit Follow-up',
        label2: 'متابعة الإيداعات النقدية',
        path: '/dashboard/internal_fin/cash-drawers/follow-up',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager'],
        permissions: ['cash_drawer:view_reports'],
      },
      {
        key: 'billing_cash_drawer_variance_approvals',
        label: 'Cash Variance Approvals',
        label2: 'اعتماد فروقات النقد',
        path: '/dashboard/internal_fin/cash-drawers/variance-approvals',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'finance_manager'],
        permissions: ['cash_drawer:approve_variance'],
      },
      {
        key: 'billing_cash_drawer_in_transit',
        label: 'Cash In Transit',
        label2: 'النقد قيد النقل',
        path: '/dashboard/internal_fin/cash-drawers/in-transit',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator'],
        permissions: ['cash_drawer:transfer'],
      },
      {
        key: 'billing_pos_sessions',
        label: 'POS Sessions',
        label2: 'جلسات نقطة البيع',
        path: '/dashboard/internal_fin/pos-sessions',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator', 'cashier'],
        permissions: ['pos_session:view'],
      },
      {
        key: 'billing_refunds',
        label: 'Refunds',
        label2: 'المرتجعات',
        path: '/dashboard/internal_fin/refunds',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator'],
        permissions: ['orders:process_refund'],
      },
      {
        key: 'billing_pending_payments',
        label: 'Pending Payments',
        label2: 'الدفعات المعلقة',
        path: '/dashboard/internal_fin/pending-payments',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'finance_manager'],
        permissions: ['orders:pending_payments_view'],
      },
      {
        key: 'billing_reconciliation',
        label: 'Reconciliation',
        label2: 'التسوية المالية',
        path: '/dashboard/internal_fin/reconciliation',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager'],
        permissions: ['reconciliation:view'],
      },
      {
        key: 'finance_outbox_monitor',
        label: 'Outbox Monitor',
        label2: 'مراقبة صندوق الأحداث',
        path: '/dashboard/internal_fin/outbox',
        roles: ['super_admin', 'tenant_admin', 'admin', 'finance_manager'],
        permissions: ['finance_outbox:view'],
      },
      {
        key: 'finance_vouchers',
        label: 'Business Vouchers',
        label2: 'السندات التجارية',
        path: '/dashboard/internal_fin/vouchers',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator', 'cashier'],
        permissions: ['fin_vouchers:view'],
      },
      {
        key: 'finance_vouchers_new',
        label: 'New Voucher',
        label2: 'سند جديد',
        path: '/dashboard/internal_fin/vouchers/new',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator', 'cashier'],
        permissions: ['fin_vouchers:create'],
      },
      {
        key: 'finance_vouchers_reports',
        label: 'Voucher Reports',
        label2: 'تقارير السندات',
        path: '/dashboard/internal_fin/vouchers/reports',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager'],
        permissions: ['fin_vouchers:reports'],
      },
    ],
  },
  {
    key: 'reports',
    label: 'Reports & Analytics',
    icon: BarChart3,
    path: '/dashboard/reports',
    roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
    children: [
      {
        key: 'reports_orders',
        label: 'Orders & Sales',
        path: '/dashboard/reports/orders',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        featureFlag: FLAG_KEYS.ADVANCED_ANALYTICS,
      },
      {
        key: 'reports_payments',
        label: 'Payments',
        path: '/dashboard/reports/payments',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        featureFlag: FLAG_KEYS.ADVANCED_ANALYTICS,
      },
      {
        key: 'reports_invoices',
        label: 'Invoices',
        path: '/dashboard/reports/invoices',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        featureFlag: FLAG_KEYS.ADVANCED_ANALYTICS,
      },
      {
        key: 'reports_revenue',
        label: 'Revenue',
        path: '/dashboard/reports/revenue',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        featureFlag: FLAG_KEYS.ADVANCED_ANALYTICS,
      },
      {
        key: 'reports_customers',
        label: 'Customers',
        path: '/dashboard/reports/customers',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        featureFlag: FLAG_KEYS.ADVANCED_ANALYTICS,
      },
      {
        key: 'reports_financial',
        label: 'Financial Reports',
        label2: 'التقارير المالية',
        path: '/dashboard/reports/financial',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'viewer'],
        permissions: ['finance_reports:view'],
        featureFlag: FLAG_KEYS.ADVANCED_ANALYTICS,
      },
      {
        key: 'reports_reconciliation',
        label: 'Reconciliation',
        label2: 'التسوية',
        path: '/dashboard/reports/reconciliation',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'viewer'],
        permissions: ['finance_reports:view'],
        featureFlag: FLAG_KEYS.ADVANCED_ANALYTICS,
      },
      {
        key: 'reports_cash_variance',
        label: 'Cash Variance by Cashier',
        label2: 'فروقات النقد حسب الكاشير',
        path: '/dashboard/reports/cash-variance',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'accountant', 'finance_manager'],
        permissions: ['cash_drawer:view_reports'],
      },
    ],
  },
  {
    key: 'erp_lite',
    label: 'ERP-Lite',
    icon: Landmark,
    path: '/dashboard/erp-lite',
    roles: ['admin', 'super_admin', 'tenant_admin'],
    permissions: ['erp_lite:view'],
    featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,
    children: [
      {
        key: 'erp_lite_home',
        label: 'Overview',
        path: '/dashboard/erp-lite',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,
      },
      // Ops / pilot surfaces first (same routes as app/dashboard/erp-lite/*)
      {
        key: 'erp_lite_readiness',
        label: 'Finance Readiness',
        path: '/dashboard/erp-lite/readiness',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,
      },
      {
        key: 'erp_lite_setup',
        label: 'Setup guide',
        path: '/dashboard/erp-lite/setup',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,
      },
      {
        key: 'erp_lite_usage_maps',
        label: 'Usage Mapping',
        path: '/dashboard/erp-lite/usage-maps',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_usage_map:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,
      },
      {
        key: 'erp_lite_exceptions',
        label: 'Exception Workbench',
        path: '/dashboard/erp-lite/exceptions',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_exceptions:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,
      },
      {
        key: 'erp_lite_periods',
        label: 'Period Management',
        path: '/dashboard/erp-lite/periods',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_periods:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,
      },
      {
        key: 'erp_lite_finance_actions',
        label: 'Finance control audit',
        path: '/dashboard/erp-lite/finance-actions',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_periods:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,
      },
      {
        key: 'erp_lite_post_audit',
        label: 'Posting Audit',
        path: '/dashboard/erp-lite/posting-audit',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_post_audit:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,
      },
      {
        key: 'erp_lite_coa',
        label: 'Chart of Accounts',
        path: '/dashboard/erp-lite/coa',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_coa:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_GL_ENABLED,
      },
      {
        key: 'erp_lite_gl',
        label: 'General Ledger',
        path: '/dashboard/erp-lite/gl',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_gl:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_GL_ENABLED,
      },
      {
        key: 'erp_lite_journals',
        label: 'Journal register',
        path: '/dashboard/erp-lite/journals',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_gl:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,
      },
      {
        key: 'erp_lite_ar',
        label: 'AR Aging',
        path: '/dashboard/erp-lite/ar',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_ar:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_AR_ENABLED,
      },
      {
        key: 'erp_lite_ap',
        label: 'Accounts Payable',
        path: '/dashboard/erp-lite/ap',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_ap:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_AP_ENABLED,
      },
      {
        key: 'erp_lite_po',
        label: 'Purchase Orders',
        path: '/dashboard/erp-lite/po',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_po:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_PO_ENABLED,
      },
      {
        key: 'erp_lite_expenses',
        label: 'Expenses',
        path: '/dashboard/erp-lite/expenses',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_expenses:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_EXPENSES_ENABLED,
      },
      {
        key: 'erp_lite_bank_recon',
        label: 'Bank Reconciliation',
        path: '/dashboard/erp-lite/bank-recon',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_bank_recon:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_BANK_RECON_ENABLED,
      },
      {
        key: 'erp_lite_branch_pl',
        label: 'Branch P&L',
        path: '/dashboard/erp-lite/branch-pl',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_branch_pl:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_BRANCH_PL_ENABLED,
      },
      {
        key: 'erp_lite_reports',
        label: 'Financial Reports',
        path: '/dashboard/erp-lite/reports',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['erp_lite_reports:view'],
        featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,
      },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    path: '/dashboard/marketing',
    roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
    permissions: ['promotions:read'],
    children: [
      {
        key: 'marketing_promos',
        label: 'Promo Codes',
        path: '/dashboard/marketing/promos',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        permissions: ['promotions:read'],
      },
      {
        key: 'marketing_gift_cards',
        label: 'Gift Cards',
        path: '/dashboard/marketing/gift-cards',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        permissions: ['gift_cards:read'],
      },
      {
        key: 'marketing_discount_rules',
        label: 'Discount Rules',
        path: '/dashboard/marketing/discount-rules',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['discount_rules:read'],
      },
      {
        key: 'marketing_loyalty',
        label: 'Loyalty Program',
        label2: 'برنامج الولاء',
        path: '/dashboard/marketing/loyalty',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['loyalty:view_config'],
      },
      {
        key: 'marketing_campaigns',
        label: 'Campaigns',
        label2: 'الحملات الإعلانية',
        path: '/dashboard/marketing/campaigns',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['notifications:manage'],
        featureFlag: FLAG_KEYS.CAMPAIGNS_ENABLED,
      },
    ],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    label2: 'الإشعارات',
    icon: Bell,
    path: '/dashboard/notifications',
    roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator', 'viewer'],
    permissions: ['notifications:read'],
    children: [
      {
        key: 'notifications_center',
        label: 'Notification Center',
        label2: 'مركز الإشعارات',
        path: '/dashboard/notifications',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator', 'viewer'],
        permissions: ['notifications:read'],
      },
      {
        key: 'notifications_delivery_log',
        label: 'Delivery Log',
        label2: 'سجل التسليم',
        path: '/dashboard/notifications/delivery-log',
        roles: ['super_admin', 'tenant_admin', 'admin', 'branch_manager'],
        permissions: ['notifications:view_log'],
      },
      {
        key: 'notifications_settings',
        label: 'Channel Settings',
        label2: 'إعدادات القنوات',
        path: '/dashboard/notifications/settings',
        roles: ['super_admin', 'tenant_admin', 'admin'],
        permissions: ['notifications:configure'],
      },
    ],
  },

  {
    key: 'inventory',
    label: 'Inventory & Machines',
    icon: Boxes,
    path: '/dashboard/inventory',
    roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
    children: [
      {
        key: 'inventory_stock',
        label: 'Stock',
        path: '/dashboard/inventory/stock',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        permissions: ['inventory:read'],
      },
      {
        key: 'inventory_machines',
        label: 'Machines',
        path: '/dashboard/inventory/machines',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
        permissions: ['inventory:read'],
      },
    ],
  },
  {
    key: 'config_settings',
    label: 'Config And Settings',
    icon: Settings2,
    path: '/dashboard/settings',
    roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
    permissions: ['settings:read'],
    children: [
      {
        key: 'settings_general',
        label: 'General',
        path: '/dashboard/settings/general',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['settings:read'],
      },
      {
        key: 'settings_all',
        label: 'All Settings',
        path: '/dashboard/settings/allsettings',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['settings:read'],
      },
      {
        key: 'settings_tenant',
        label: 'Tenant Settings',
        label2: 'إعدادات المستأجر',
        path: '/dashboard/settings/tenant',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['settings:tenant_manage'],
      },
      {
        key: 'settings_branches',
        label: 'Branch Settings',
        label2: 'إعدادات الفروع',
        path: '/dashboard/settings/branches',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['settings:branch_manage'],
      },
      {
        key: 'settings_preferences',
        label: 'User Preferences',
        path: '/dashboard/settings/preferences',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator', 'viewer'],
        permissions: ['settings:read'],
      },
      {
        key: 'settings_users',
        label: 'Team Members',
        path: '/dashboard/settings/users',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['settings:read'],
      },
      {
        key: 'settings_roles',
        label: 'Roles & Permissions',
        path: '/dashboard/settings/roles',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['settings:read'],
      },
      {
        key: 'settings_permissions',
        label: 'Permissions',
        path: '/dashboard/settings/permissions',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['settings:read'],
      },
      {
        key: 'settings_security',
        label: 'Security & Sessions',
        label2: 'الأمان والجلسات',
        path: '/dashboard/settings/security',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['auth_config:read'],
      },
      {
        key: 'settings_workflow_roles',
        label: 'Workflow Roles',
        path: '/dashboard/settings/workflow-roles',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['settings:workflow_roles:view'],
      },
      {
        key: 'settings_branding',
        label: 'Branding',
        path: '/dashboard/settings/branding',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['settings:read'],
      },
      {
        key: 'settings_finance',
        label: 'Finance',
        path: '/dashboard/settings/finance',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['settings:read'],
      },
      {
        key: 'settings_currency_fx',
        label: 'Currencies & FX',
        label2: 'العملات وأسعار الصرف',
        path: '/dashboard/settings/finance/currency-fx',
        roles: ['admin', 'super_admin', 'tenant_admin', 'finance_manager'],
        permissions: ['currencies:view'],
      },
      {
        key: 'settings_payments',
        label: 'Payment Setup',
        path: '/dashboard/settings/payments',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['settings:read'],
      },
      {
        key: 'settings_cash_control',
        label: 'Cash Control Settings',
        label2: 'إعدادات ضبط النقد',
        path: '/dashboard/settings/payments/cash-control-settings',
        roles: ['admin', 'super_admin', 'tenant_admin', 'branch_manager', 'finance_manager', 'operator'],
        permissions: ['cash_control:view'],
      },
      {
        key: 'settings_pos',
        label: 'POS Settings',
        label2: 'إعدادات نقطة البيع',
        path: '/dashboard/settings/pos-settings',
        roles: ['admin', 'super_admin', 'tenant_admin', 'branch_manager', 'finance_manager', 'operator'],
        permissions: ['cash_control:view'],
      },
      {
        key: 'settings_workflows',
        label: 'Workflows',
        path: '/dashboard/settings/workflows',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['settings:workflow'],
      },
      {
        key: 'settings_navigation',
        label: 'Navigation',
        path: '/dashboard/settings/navigation',
        roles: ['super_admin', 'tenant_admin'],
        permissions: ['settings:read'],
      },
      {
        key: 'settings_tax',
        label: 'Tax Setup',
        label2: 'إعداد الضريبة',
        path: '/dashboard/settings/tax',
        roles: ['admin', 'super_admin', 'tenant_admin'],
        permissions: ['tax:view_config'],
      },
    ],
  },
  {
    key: 'tenant_admin',
    label: 'Tenant Admin',
    label2: 'إدارة المستأجر',
    icon: Building2,
    path: '/dashboard/tenant-admin/subscription',
    roles: ['admin', 'super_admin', 'tenant_admin'],
    permissions: ['settings:subscription'],
    children: [
      {
        key: 'tenant_admin_subscription',
        label: 'Subscription',
        label2: 'الاشتراك',
        path: '/dashboard/tenant-admin/subscription',
        roles: ['admin', 'super_admin', 'tenant_admin', 'viewer', 'operator'],
        permissions: ['settings:subscription'],
      },
    ],
  },
  {
    key: 'help',
    label: 'Help',
    icon: LifeBuoy,
    path: '/dashboard/help',
    roles: ['super_admin', 'tenant_admin', 'admin', 'operator'],
  },
  {
    key: 'jhtestui',
    label: 'JWT Test',
    icon: Bug,
    path: '/dashboard/jhtestui',
    roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
    permissions: ['admin:manage'],
  },

]

/**
 * Permission codes from sys_components_cd.main_permission_code, keyed by comp_code.
 * Null means every signed-in user. A key present here replaces navigation.ts permissions.
 */
export type MainPermissionByKey = Readonly<Record<string, string | null>>

/**
 * sys_components_cd.main_permission_code wins over the permissions array in navigation.ts.
 * A missing key keeps the navigation.ts list. Null or blank from the database means every signed-in user.
 * @param key Menu comp_code
 * @param navigationPermissions Permissions declared in navigation.ts
 * @param mainPermissionByKey Database codes for the same keys
 * @returns The permission list that decides visibility
 */
function permissionsForMenuItem(
  key: string,
  navigationPermissions: string[] | undefined,
  mainPermissionByKey?: MainPermissionByKey,
): string[] | undefined {
  if (!mainPermissionByKey || !Object.prototype.hasOwnProperty.call(mainPermissionByKey, key)) {
    return navigationPermissions
  }

  const databaseCode = mainPermissionByKey[key]?.trim()
  return databaseCode ? [databaseCode] : undefined
}

/**
 * A menu row is visible when the user holds its permission and any required feature flag.
 * No permission list means every signed-in user. Role lists are not a gate.
 * @param permissions Permission codes on the row
 * @param requireAllPermissions When true, every listed permission is required
 * @param featureFlag Flag key that must be enabled
 * @param heldPermissions Permissions held by the signed-in user
 * @param featureFlags Enabled feature flags
 */
function navigationItemVisible(
  permissions: string[] | undefined,
  requireAllPermissions: boolean | undefined,
  featureFlag: string | undefined,
  heldPermissions: string[],
  featureFlags: Record<string, boolean>,
): boolean {
  if (featureFlag && !featureFlags[featureFlag]) {
    return false
  }

  if (!permissions || permissions.length === 0) {
    return true
  }

  return requireAllPermissions
    ? permissions.every((permission) => heldPermissions.includes(permission))
    : permissions.some((permission) => heldPermissions.includes(permission))
}

/**
 * Fallback menu filtered by permission and feature flag.
 * When mainPermissionByKey contains a key, that database code replaces navigation.ts permissions.
 * Rows with no permissions stay visible to every signed-in user.
 * A parent stays when one of its children is visible, even if the parent permission is missing.
 * @param _role Unused. Kept so existing callers do not change.
 * @param featureFlags Enabled feature flags
 * @param permissions Permissions held by the signed-in user
 * @param mainPermissionByKey Database main_permission_code by comp_code. Wins over navigation.ts.
 * @returns Filtered navigation sections
 */
export function getNavigationForRole(
  _role: UserRole | null,
  featureFlags: Record<string, boolean> = {},
  permissions: string[] = [],
  mainPermissionByKey?: MainPermissionByKey,
): NavigationSection[] {
  return NAVIGATION_SECTIONS.flatMap((section) => {
    if (section.featureFlag && !featureFlags[section.featureFlag]) {
      return []
    }

    const sectionPermissions = permissionsForMenuItem(
      section.key,
      section.permissions,
      mainPermissionByKey,
    )
    const sectionFromDatabase = !!mainPermissionByKey && Object.prototype.hasOwnProperty.call(mainPermissionByKey, section.key)

    if (!section.children) {
      return navigationItemVisible(
        sectionPermissions,
        sectionFromDatabase ? false : section.requireAllPermissions,
        undefined,
        permissions,
        featureFlags,
      )
        ? [section]
        : []
    }

    const children = section.children.filter((child) => {
      const childFromDatabase = !!mainPermissionByKey && Object.prototype.hasOwnProperty.call(mainPermissionByKey, child.key)
      return navigationItemVisible(
        permissionsForMenuItem(child.key, child.permissions, mainPermissionByKey),
        childFromDatabase ? false : child.requireAllPermissions,
        child.featureFlag,
        permissions,
        featureFlags,
      )
    })

    if (children.length === 0) {
      return []
    }

    return [{ ...section, children }]
  })
}

/**
 * Find navigation item by path
 * @param path Current route path
 * @returns Matching navigation section or null
 */
export function findNavigationByPath(path: string): NavigationSection | null {
  for (const section of NAVIGATION_SECTIONS) {
    if (section.path === path) {
      return section
    }
    if (section.children) {
      const child = section.children.find((c) => c.path === path)
      if (child) {
        return section
      }
    }
  }
  return null
}

/**
 * Check if path is active
 * @param currentPath Current route path
 * @param itemPath Navigation item path
 * @returns True if path matches or is a child route
 */
export function isPathActive(currentPath: string, itemPath: string): boolean {
  const cur = currentPath.replace(/\/$/, '') || '/'
  const item = itemPath.replace(/\/$/, '') || '/'
  if (cur === item) {
    return true
  }
  // `/dashboard` must match only the hub — otherwise every `/dashboard/*` route highlights Dashboard.
  if (item === '/dashboard' && cur !== '/dashboard') {
    return false
  }
  return cur.startsWith(item + '/')
}
