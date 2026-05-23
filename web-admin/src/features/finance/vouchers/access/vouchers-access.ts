/**
 * Voucher route contracts live beside the voucher feature so the canonical
 * posting/wiring permissions stay close to the UI that uses them.
 */
import type { PageAccessContract } from '@/lib/auth/access-contracts';
import { CASHIER_ALLOWED_VOUCHER_TYPES, CASHIER_ALLOWED_LINE_ROLES } from '@/lib/constants/voucher';

export function getAllowedVoucherTypes(userRole: string): string[] {
  if (userRole === 'cashier') return [...CASHIER_ALLOWED_VOUCHER_TYPES];
  return ['RECEIPT_VOUCHER', 'PAYMENT_VOUCHER', 'REFUND_VOUCHER', 'ADJUSTMENT_VOUCHER', 'TRANSFER_VOUCHER'];
}

export function getAllowedLineRoles(userRole: string): string[] {
  if (userRole === 'cashier') return [...CASHIER_ALLOWED_LINE_ROLES];
  return [
    'ORDER_PAYMENT', 'INVOICE_PAYMENT', 'CUSTOMER_ADVANCE_RECEIPT', 'WALLET_TOPUP',
    'GIFT_CARD_SALE', 'CUSTOMER_CREDIT_RECEIPT', 'SUPPLIER_PAYMENT', 'EXPENSE_PAYMENT',
    'SHOP_RENT_PAYMENT', 'UTILITY_PAYMENT', 'EMPLOYEE_ADVANCE_PAYMENT', 'PETTY_CASH_ISSUE',
    'CUSTOMER_REFUND', 'ORDER_REFUND', 'INVOICE_REFUND', 'WALLET_REFUND',
    'ADVANCE_REFUND', 'GIFT_CARD_REFUND', 'TRANSFER_IN', 'TRANSFER_OUT',
  ];
}

export function hasVoucherPermission(userRole: string, permission: string): boolean {
  const rolePermissions: Record<string, string[]> = {
    cashier:        ['fin_vouchers:view', 'fin_vouchers:create', 'fin_vouchers:post', 'fin_vouchers:print', 'fin_voucher_lines:create'],
    operator:       ['fin_vouchers:view', 'fin_vouchers:create', 'fin_vouchers:post', 'fin_vouchers:print', 'fin_voucher_lines:create'],
    branch_manager: ['fin_vouchers:view', 'fin_vouchers:create', 'fin_vouchers:update', 'fin_vouchers:post', 'fin_vouchers:cancel', 'fin_vouchers:print', 'fin_vouchers:export', 'fin_voucher_lines:create', 'fin_voucher_lines:update', 'fin_voucher_lines:delete_draft', 'fin_expenses:create', 'fin_refunds:create'],
    admin:          ['*'],
    tenant_admin:   ['*'],
    super_admin:    ['*'],
  };

  const perms = rolePermissions[userRole] ?? [];
  return perms.includes('*') || perms.includes(permission);
}

export const VOUCHER_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/internal_fin/vouchers',
    label: 'Business Vouchers',
    page: { permissions: ['fin_vouchers:view'], requireAllPermissions: true },
    actions: {
      createVoucher: {
        label: 'Create voucher',
        requirement: { permissions: ['fin_vouchers:create'], requireAllPermissions: true },
      },
      postVoucher: {
        label: 'Post voucher',
        requirement: { permissions: ['fin_vouchers:post'], requireAllPermissions: true },
      },
      cancelVoucher: {
        label: 'Cancel voucher',
        requirement: { permissions: ['fin_vouchers:cancel'], requireAllPermissions: true },
      },
      reverseVoucher: {
        label: 'Reverse voucher',
        requirement: { permissions: ['fin_vouchers:reverse'], requireAllPermissions: true },
      },
    },
    apiDependencies: [
      {
        label: 'List vouchers',
        method: 'GET',
        path: '/api/v1/finance/vouchers',
        requirement: { permissions: ['fin_vouchers:view'], requireAllPermissions: true },
      },
      {
        label: 'Create voucher',
        method: 'POST',
        path: '/api/v1/finance/vouchers',
        requirement: { permissions: ['fin_vouchers:create'], requireAllPermissions: true },
      },
    ],
    notes: ['Canonical voucher hub route. Linked effects, posting, and cancellation stay on voucher service boundaries.'],
  },
  {
    routePattern: '/dashboard/internal_fin/vouchers/new',
    label: 'New Business Voucher',
    page: { permissions: ['fin_vouchers:create'], requireAllPermissions: true },
    apiDependencies: [
      {
        label: 'Create voucher',
        method: 'POST',
        path: '/api/v1/finance/vouchers',
        requirement: { permissions: ['fin_vouchers:create'], requireAllPermissions: true },
      },
    ],
    notes: ['Draft voucher creation route for the canonical voucher stack.'],
  },
  {
    routePattern: '/dashboard/internal_fin/vouchers/[voucherId]',
    label: 'Voucher Detail',
    page: { permissions: ['fin_vouchers:view'], requireAllPermissions: true },
    actions: {
      updateVoucher: {
        label: 'Update voucher draft',
        requirement: { permissions: ['fin_vouchers:update'], requireAllPermissions: true },
      },
      postVoucher: {
        label: 'Post voucher',
        requirement: { permissions: ['fin_vouchers:post'], requireAllPermissions: true },
      },
      cancelVoucher: {
        label: 'Cancel voucher',
        requirement: { permissions: ['fin_vouchers:cancel'], requireAllPermissions: true },
      },
      viewLinkedEffects: {
        label: 'View voucher linked effects',
        requirement: { permissions: ['fin_vouchers:view_effects'], requireAllPermissions: true },
      },
    },
    apiDependencies: [
      {
        label: 'Get voucher detail',
        method: 'GET',
        path: '/api/v1/finance/vouchers/[voucherId]',
        requirement: { permissions: ['fin_vouchers:view'], requireAllPermissions: true },
      },
      {
        label: 'Update voucher draft',
        method: 'PATCH',
        path: '/api/v1/finance/vouchers/[voucherId]',
        requirement: { permissions: ['fin_vouchers:update'], requireAllPermissions: true },
      },
      {
        label: 'Post voucher',
        method: 'POST',
        path: '/api/v1/finance/vouchers/[voucherId]/post',
        requirement: { permissions: ['fin_vouchers:post'], requireAllPermissions: true },
      },
      {
        label: 'Cancel voucher',
        method: 'POST',
        path: '/api/v1/finance/vouchers/[voucherId]/cancel',
        requirement: { permissions: ['fin_vouchers:cancel'], requireAllPermissions: true },
      },
      {
        label: 'Get voucher linked effects',
        method: 'GET',
        path: '/api/v1/finance/vouchers/[voucherId]/linked-effects',
        requirement: { permissions: ['fin_vouchers:view_effects'], requireAllPermissions: true },
      },
      {
        label: 'Get voucher line linked effects',
        method: 'GET',
        path: '/api/v1/finance/voucher-lines/[lineId]/linked-effects',
        requirement: { permissions: ['fin_vouchers:view_effects'], requireAllPermissions: true },
      },
    ],
    notes: ['Voucher detail route is the canonical place to review posting results and operational linked effects.'],
  },
  {
    routePattern: '/dashboard/internal_fin/vouchers/reports',
    label: 'Voucher Reports',
    page: { permissions: ['fin_vouchers:reports'], requireAllPermissions: true },
    notes: ['Reporting route for posted voucher analysis.'],
  },
];
