import type { PageAccessContract } from '@/lib/auth/access-contracts'

export const CORE_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/jhtestui',
    label: 'JWT Test',
    page: {},
    notes: ['Debug route with no explicit UI permission gate.'],
  },
]

export const CORE_JHTESTUI_ACCESS = CORE_ACCESS_CONTRACTS[0]!
