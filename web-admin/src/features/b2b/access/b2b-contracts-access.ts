import type { PageAccessContract } from '@/lib/auth/access-contracts'

export const B2B_CONTRACTS_ACCESS: PageAccessContract = {
  path: '/dashboard/b2b/contracts',
  label: 'Contracts',
  page: {
    permissions: ['b2b_contracts:view'],
    requireAllPermissions: true,
    featureFlags: ['b2b_contracts'],
  },
  actions: {
    createContract: {
      label: 'Create contract',
      requirement: {
        permissions: ['b2b_contracts:create'],
        requireAllPermissions: true,
      },
    },
  },
}
