/**
 * Tenant Currency & FX route contract (Tenant_Currency_FX plan 01 §7.2).
 * Permission codes come from `lib/constants/permissions/currency-fx-perm.ts`
 * (mirrors migration 0538, applied). Server actions under `app/actions/fx/`
 * are the enforcement layer the `apiDependencies` entries below describe.
 */
import type { PageAccessContract } from '@/lib/auth/access-contracts';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';

export const CURRENCY_FX_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/settings/finance/currency-fx',
    label: 'Currencies & FX',
    page: {
      permissions: [CURRENCY_FX_PERMISSIONS.CURRENCIES_VIEW],
      requireAllPermissions: true,
    },
    actions: {
      manageCurrencies: {
        label: 'Add, edit, deactivate, or reactivate a portfolio currency',
        requirement: { permissions: [CURRENCY_FX_PERMISSIONS.CURRENCIES_MANAGE], requireAllPermissions: true },
      },
      setBaseCurrency: {
        label: 'Change the tenant base (functional) currency (C6, DB-locked once orders exist)',
        requirement: { permissions: [CURRENCY_FX_PERMISSIONS.CURRENCIES_SET_BASE], requireAllPermissions: true },
      },
      viewRates: {
        label: 'View the tenant exchange-rate book',
        requirement: { permissions: [CURRENCY_FX_PERMISSIONS.FX_RATES_VIEW], requireAllPermissions: true },
      },
      manageRates: {
        label: 'Create or edit a draft exchange rate',
        requirement: { permissions: [CURRENCY_FX_PERMISSIONS.FX_RATES_MANAGE], requireAllPermissions: true },
      },
      approveRates: {
        label: 'Approve or reject a draft exchange rate',
        requirement: { permissions: [CURRENCY_FX_PERMISSIONS.FX_RATES_APPROVE], requireAllPermissions: true },
      },
      importRates: {
        label: 'Preview and commit an HQ-copy rate import',
        requirement: { permissions: [CURRENCY_FX_PERMISSIONS.FX_RATES_IMPORT], requireAllPermissions: true },
      },
      manualOverrideRates: {
        label: 'Void an approved rate, or self-approve a rate on create (manual override)',
        requirement: { permissions: [CURRENCY_FX_PERMISSIONS.FX_RATES_MANUAL_OVERRIDE], requireAllPermissions: true },
      },
    },
    apiDependencies: [
      { label: 'Currency portfolio + rate CRUD + FX settings', method: 'GET', path: '/app/actions/fx/currency-actions', requirement: { permissions: [CURRENCY_FX_PERMISSIONS.CURRENCIES_VIEW] }, enforcement: 'external', notes: ['Server actions, not an HTTP route — see app/actions/fx/*.'] },
      { label: 'Rate book CRUD + lifecycle', method: 'GET', path: '/app/actions/fx/rate-actions', requirement: { permissions: [CURRENCY_FX_PERMISSIONS.FX_RATES_VIEW] }, enforcement: 'external', notes: ['Server actions, not an HTTP route.'] },
      { label: 'HQ-copy import preview/commit', method: 'GET', path: '/app/actions/fx/import-actions', requirement: { permissions: [CURRENCY_FX_PERMISSIONS.FX_RATES_IMPORT] }, enforcement: 'external', notes: ['Server actions, not an HTTP route.'] },
      { label: 'Tenant FX policy settings', method: 'GET', path: '/app/actions/fx/settings-actions', requirement: { permissions: [CURRENCY_FX_PERMISSIONS.FX_RATES_VIEW] }, enforcement: 'external', notes: ['Server actions, not an HTTP route.'] },
      { label: 'Currency/rate-type/source catalog lookups', method: 'GET', path: '/app/actions/fx/lookup-actions', requirement: { permissions: [CURRENCY_FX_PERMISSIONS.CURRENCIES_VIEW] }, enforcement: 'external', notes: ['Server actions, not an HTTP route.'] },
      { label: 'Read-only FX converter preview', method: 'GET', path: '/app/actions/fx/converter-actions', requirement: { permissions: [CURRENCY_FX_PERMISSIONS.FX_RATES_VIEW] }, enforcement: 'external', notes: ['Server actions, not an HTTP route.'] },
    ],
    notes: [
      'HQ-copy is the only import adapter wired in 5C; CSV/Excel/URL (5D/5E) show as "coming soon" in the UI with no server action behind them yet.',
      'currencies:set_base and fx_rates:manual_override are deliberately separate, elevated permissions — see plan 01 C6 and P5/P6.',
    ],
  },
];
