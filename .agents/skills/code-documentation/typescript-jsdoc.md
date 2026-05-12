# TypeScript JSDoc Templates

Copy-paste templates for each file type in CleanMateX. Always adapt descriptions to the actual function.

---

## Server Action

```typescript
/**
 * [Action name]: [one-line description in imperative mood]
 *
 * [Optional: business context sentence — why this action exists]
 *
 * Tenant resolved server-side from authenticated session via getAuthContext().
 *
 * @param input - [shape description]
 * @returns ActionResult with [entity] or structured error
 * @throws Never — errors are caught and returned as { success: false, error }
 */
export async function createOrderAction(input: CreateOrderInput): Promise<ActionResult<Order>> {
```

---

## API Route Handler

```typescript
/**
 * GET /api/v1/orders
 *
 * Returns a paginated list of orders for the authenticated tenant.
 * Tenant isolation enforced by Supabase RLS via withTenantContext.
 *
 * @returns Paginated result or error JSON
 */
export async function GET(request: NextRequest) {
```

```typescript
/**
 * POST /api/v1/orders
 *
 * Creates a new order for the authenticated tenant.
 * Validates input, resolves tenant, writes to DB, invalidates order list cache.
 *
 * @returns Created order or structured error JSON
 */
export async function POST(request: NextRequest) {
```

---

## Service Method

```typescript
/**
 * Retrieve paginated orders for a tenant, optionally filtered by status and date range.
 *
 * All Prisma queries scoped to tenantOrgId via withTenantContext.
 * Do NOT call without a validated tenantOrgId — RLS will block the query.
 *
 * @param tenantOrgId - Tenant organisation ID; enforces row-level isolation
 * @param filters - Optional filter criteria (status, dateFrom, dateTo, page, pageSize)
 * @returns PaginatedResult<Order>
 * @throws PrismaClientKnownRequestError on DB constraint violations
 *
 * @example
 * const result = await orderService.getOrders('org_123', { status: 'NEW', page: 1 });
 * // result.data → Order[], result.total → number
 */
async getOrders(tenantOrgId: string, filters?: OrderFilters): Promise<PaginatedResult<Order>> {
```

---

## React Hook

```typescript
/**
 * Fetches and caches the paginated order list for the current tenant.
 *
 * Scopes query to authenticated tenant from useAuth().
 * staleTime: 30s — order list may briefly show stale counts; acceptable for list views.
 *
 * @param filters - Active filter criteria from URL search params
 * @returns UseQueryResult<PaginatedResult<Order>>
 *
 * @example
 * const { data, isLoading } = useOrders({ status: 'NEW' });
 */
export function useOrders(filters: OrderFilters) {
```

---

## React Component + Props Interface

```typescript
/**
 * Props for OrderStatusBadge.
 */
interface OrderStatusBadgeProps {
  /** Current order status code (e.g. 'NEW', 'IN_PROGRESS', 'DONE') */
  status: OrderStatus;
  /** Optional size variant. Defaults to 'md'. */
  size?: 'sm' | 'md' | 'lg';
  /** If true, renders as a pill shape instead of a flat badge. */
  pill?: boolean;
}

/**
 * Displays a colour-coded badge for a given order status.
 * Colours defined in Cmx Design System tokens. Supports RTL via Tailwind rtl: variants.
 */
export function OrderStatusBadge({ status, size = 'md', pill = false }: OrderStatusBadgeProps) {
```

---

## Type / Interface

```typescript
/**
 * Result shape returned by all server actions in CleanMateX.
 * On success, `data` is defined. On failure, `error` is defined.
 * Never throws — always returns this shape.
 */
export interface ActionResult<T> {
  success: boolean;
  data?: T;
  /** Human-readable error message, English only */
  error?: string;
  /** Optional field-level validation errors keyed by field name */
  fieldErrors?: Record<string, string>;
}
```

---

## Constant (`lib/constants/`)

```typescript
/**
 * Canonical order status codes — single source of truth for order workflow.
 * Derive the OrderStatus type from this object:
 *   type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]
 *
 * Changing a value here affects: DB queries, UI badges, and i18n keys.
 * Add new statuses in `supabase/migrations/` workflow table first.
 */
export const ORDER_STATUS = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
```

---

## useRef Guard Pattern

```typescript
// isFetchingRef: in-flight lock — prevents concurrent fetch calls during React re-renders
// loadedForTenantRef: per-tenant loaded flag — avoids re-fetch when component re-mounts
// Together these prevent the fetch loop described in debugging skill Issue 13
const isFetchingRef = useRef(false);
const loadedForTenantRef = useRef<string | null>(null);
```

---

## Mandatory Inline Comment Examples

```typescript
// ─── Tenant Resolution ────────────────────────────────────────────────────
// Tenant resolved server-side from authenticated session — never trust client-supplied tenant IDs
const { tenantOrgId, userId } = await getAuthContext();

// ─── CSRF / Rate-limit ────────────────────────────────────────────────────
// Rate limit: 20 order-creation requests per minute per tenant to prevent abuse
const { success: rateLimitOk } = await ratelimit.limit(`create-order:${tenantOrgId}`);
if (!rateLimitOk) return { success: false, error: 'Too many requests' };

// Cache invalidation: clear order list so the new order appears immediately in the UI
revalidatePath('/dashboard/orders');

// Magic number: 5 * 60 * 1000 = 5 minutes TTL for order status cache
const ORDER_STATUS_STALE_TIME = 5 * 60 * 1000;

// Prevent query before tenant is confirmed — avoids unauthenticated DB call
enabled: !!currentTenant,
```

---

## Section Separators (Functions > 40 Lines)

```typescript
// ─── Input Validation ─────────────────────────────────────────────────────
// ─── Tenant Resolution ────────────────────────────────────────────────────
// ─── Business Rule Checks ─────────────────────────────────────────────────
// ─── Database Write ───────────────────────────────────────────────────────
// ─── Cache Invalidation ───────────────────────────────────────────────────
// ─── Response ─────────────────────────────────────────────────────────────
```
