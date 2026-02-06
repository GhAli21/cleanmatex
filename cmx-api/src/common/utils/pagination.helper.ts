import type { PaginationMeta } from '../interfaces/pagination-meta.interface';
import type { PaginatedResponse } from '../interfaces/paginated-response.interface';

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const meta: PaginationMeta = {
    page,
    limit,
    total,
  };
  return { data, meta };
}
