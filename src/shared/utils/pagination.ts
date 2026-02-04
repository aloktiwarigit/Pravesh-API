export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
    total?: number;
  };
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function parsePagination(query: { cursor?: string; limit?: string }): PaginationParams {
  const limit = Math.min(
    Math.max(parseInt(query.limit || String(DEFAULT_PAGE_SIZE), 10), 1),
    MAX_PAGE_SIZE
  );
  return {
    cursor: query.cursor || undefined,
    limit,
  };
}

export function buildPaginatedResponse<T extends { id: string }>(
  items: T[],
  limit: number,
  total?: number
): PaginatedResult<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const cursor = data.length > 0 ? data[data.length - 1].id : null;

  return {
    data,
    meta: {
      cursor,
      hasMore,
      total,
    },
  };
}
