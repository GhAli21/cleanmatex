import type { PageAccessContract } from '@/lib/auth/access-contracts'
import { B2B_CONTRACTS_ACCESS } from '@/src/features/b2b/access/b2b-contracts-access'

const PAGE_ACCESS_CONTRACTS: PageAccessContract[] = [
  B2B_CONTRACTS_ACCESS,
]

export function getPageAccessContractByPath(path: string): PageAccessContract | null {
  return PAGE_ACCESS_CONTRACTS.find((contract) => contract.path === path) ?? null
}
