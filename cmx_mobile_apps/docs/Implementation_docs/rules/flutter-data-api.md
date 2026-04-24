---
description: Flutter API, repository, HTTP client, interceptors, and offline-resilience rules for CleanMateX mobile apps
globs:
  - "cmx_mobile_apps/apps/customer_app/lib/**/*.dart"
  - "cmx_mobile_apps/apps/staff_app/lib/**/*.dart"
  - "cmx_mobile_apps/apps/driver_app/lib/**/*.dart"
  - "cmx_mobile_apps/packages/mobile_services/**/*.dart"
alwaysApply: true
---

# CleanMateX Flutter Data/API Rules

## API Strategy

Mobile apps are API-driven. All traffic goes to `cmx-api` — Supabase is internal to `cmx-api` and is never accessed directly from mobile.

Layer flow: `UI → Provider → Repository → DataSource → MobileHttpClient → cmx-api`

`supabase_flutter` is **banned** from all mobile apps and packages.

## HTTP Client

All HTTP goes through `MobileHttpClient` from `package:mobile_services/mobile_services.dart`.

Never use `http`, `dio`, or any HTTP package directly in app or feature code. `mobile_services` owns the `http` package dependency — apps and features import only `MobileHttpClient`.

```dart
// In a service (packages/mobile_services)
class OrderTrackingService {
  OrderTrackingService({required MobileHttpClient httpClient})
      : _client = httpClient;
  final MobileHttpClient _client;

  Future<List<OrderSummaryModel>> getOrders({
    required String tenantOrgId,
    required String accessToken,
  }) async {
    final json = await _client.getJson(
      '/v1/customer/orders',
      headers: {'Authorization': 'Bearer $accessToken'},
      queryParameters: {'tenant_org_id': tenantOrgId},
    );
    final list = json['data'] as List<Object?>;
    return list
        .map((e) => OrderSummaryModel.fromJson(e as Map<String, Object?>))
        .toList();
  }
}
```

## Required Interceptors

Every HTTP client must apply these interceptors in order:

| Order | Interceptor | Responsibility |
|---|---|---|
| 1 | `AuthInterceptor` | Attaches `Authorization: Bearer {token}`; triggers refresh on 401; forces logout if refresh fails |
| 2 | `TenantInterceptor` | Injects `X-Tenant-Id` header from active `TenantSession` on every request |
| 3 | `LoggingInterceptor` | Logs request/response in **debug builds only**; omits sensitive fields in staging/prod |
| 4 | `RetryInterceptor` | Retries idempotent GET requests up to 3× on network errors with exponential backoff |

`X-Tenant-Id` on every request is non-negotiable.

## AppException Error Hierarchy

Map all network/backend failures into the typed `AppException` hierarchy from `mobile_core` — never leak raw exceptions to UI:

```
AppException (abstract)
├── NetworkException
│   ├── TimeoutException
│   ├── NoConnectionException
│   └── ServerException            — 5xx
├── AuthException
│   ├── UnauthorizedException      — 401
│   └── ForbiddenException         — 403
├── ValidationException            — 422
├── NotFoundException              — 404
├── BusinessRuleException          — backend rejected with business reason
├── StorageException               — Hive read/write failures
└── UnexpectedException            — catch-all
```

Each exception carries: `messageKey` (i18n key shown to user), `code` (machine-readable), `originalError` (nullable, for logging only).

| Condition | Exception Type |
|---|---|
| No internet | `NoConnectionException` |
| Request timeout | `TimeoutException` |
| 401 Unauthorized | `UnauthorizedException` |
| 403 Forbidden | `ForbiddenException` |
| 422 Validation | `ValidationException` |
| 404 Not found | `NotFoundException` |
| 5xx Server error | `ServerException` |
| Business rule rejection | `BusinessRuleException` |
| Anything else | `UnexpectedException` |

Error handling contracts:
- **Repositories**: catch raw HTTP exceptions, rethrow as `AppException`
- **Providers**: catch `AppException`, surface `AsyncValue.error(exception, stack)` — UI renders from exception type
- **Widgets**: no `try/catch` in widget code — all error handling lives in providers or repositories
- Silent `catch` blocks are forbidden — always log or rethrow

In providers:
```dart
// AsyncValue.guard wraps any thrown exception in AsyncError
state = await AsyncValue.guard(() => repository.getOrders());

// Manual
try {
  final result = await repository.getOrders();
  state = state.copyWith(orders: result);
} on AppException catch (e) {
  AppLogger.error('load failed', error: e);
  rethrow;
}
```

## Token Storage and Session

- Store tokens in `flutter_secure_storage` **only** — Android Keystore / iOS Keychain backed
- Never store tokens in Riverpod state, SharedPreferences, or Hive
- Key naming: `cmx_access_token`, `cmx_refresh_token`
- Token refresh: `AuthInterceptor` triggers refresh on 401 and replays the original request
- Session hard expiry: force re-auth after 7 days regardless of refresh token state
- Never log tokens, passwords, OTPs, or sensitive PII — not in debug, not in prod

## Repository Pattern

Repositories live in `features/{feature}/data/repositories/` and depend on services from `mobile_services`.

```dart
class CustomerOrdersRepository {
  CustomerOrdersRepository({required OrderTrackingService trackingService})
      : _trackingService = trackingService;
  final OrderTrackingService _trackingService;

  Future<List<OrderSummaryModel>> getOrders() {
    return _trackingService.getOrders(...);
  }
}

// Provider wiring in core/providers/customer_api_client_providers.dart
final customerOrdersRepositoryProvider = Provider<CustomerOrdersRepository>(
  (ref) => CustomerOrdersRepository(
    trackingService: OrderTrackingService(
      httpClient: ref.read(customerApiHttpClientProvider),
    ),
  ),
);
```

Repository rules:
- Return typed results — never raw maps
- Translate datasource errors into `AppException` subclasses
- Isolate API contract knowledge from UI
- Avoid duplicating identical request logic across features

## Multi-Tenant Isolation

- All data providers must `ref.watch(tenantSessionProvider)` before fetching
- Hive box naming is namespaced per tenant: `{tenantOrgId}_{purpose}` — prevents cross-tenant data leakage on shared devices
- Never construct API paths with hardcoded tenant identifiers — always read from `TenantSession`
- `cmx-api` enforces actual tenant isolation via Supabase RLS server-side; `TenantInterceptor` is defense-in-depth only

## API Contract Discipline

- Respect backend contracts exactly — do not invent fields that the backend does not return
- Do not silently ignore required fields in responses
- If a field is nullable, handle it explicitly — never assume it will always be present
- If an API contract changes, update models, repositories, and affected UI together
- UI must not know backend JSON field names — parse at the repository/data layer only

## DTO and Entity Discipline

- **DTOs** (`data/models/`) — map directly to API response shapes
- **Entities** (`domain/`) — represent business objects after any transformation
- For simple features, a single model class is fine — do not over-engineer
- Mapping logic must be explicit and visible in source code

## Pagination and Search

- Paginate large lists — design list screens with pagination from the start
- Debounce search input before triggering API calls
- Avoid eager loading of large datasets
- Keep filter/sort state inside providers, not inline widget state

## File and Media Uploads

For images, POD, receipts, garment photos:
- Validate file size and type before upload
- Compress images where appropriate
- Show upload progress if the user must wait
- Handle cancellation cleanly
- Do not block the entire UI during an upload

## Offline and Connectivity

`ConnectivityService` in `mobile_services` exposes `isOnline` and a `connectivityChanges()` stream.

Required behavior:
- Preserve form input during failures — never discard user work on a temporary network failure
- Always provide a retry path from error states
- For critical actions that must work offline: queue the action and sync on reconnect
- Show sync/pending state clearly when queued actions are waiting to be sent
- Offline does not grant authority to finalize backend state — queued actions are intent, not truth

For driver-like workflows:
- Design for intermittent connectivity
- Capture data first, sync later when needed
- Avoid blocking mission-critical actions on perfect connectivity
