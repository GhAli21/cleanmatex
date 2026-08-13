import { useQuery } from '@tanstack/react-query';

/** Screen membership and permission metadata resolved for one tenant. */
export interface ScreenContract {
  screen: string;
  preConditions: {
    statuses: string[];
    additional_filters: Record<string, unknown>;
    required_permissions: string[];
  };
}

/**
 * Fetch the authenticated tenant's effective screen contract configuration.
 *
 * @param screen - Screen identifier (preparation, processing, assembly, etc.)
 * @returns Query state containing the effective tenant screen contract.
 * @example
 * const { data } = useScreenContract('preparation')
 */
export function useScreenContract(screen: string) {
  return useQuery<ScreenContract>({
    queryKey: ['screen-contract', screen],
    queryFn: async () => {
      const response = await fetch(`/api/v1/workflows/screens/${screen}/contract`);
      if (!response.ok) {
        throw new Error('Failed to fetch screen contract');
      }
      return response.json();
    },
    staleTime: Infinity, // Screen contracts are immutable
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
  });
}

