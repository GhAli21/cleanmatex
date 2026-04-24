# Plan: CleanMateX Customer App — Production-Readiness

**Last updated:** 2026-04-24 (repo: `f:\jhapp\cleanmatex`)

**Implementation status:** ALL phases **0–8 COMPLETE**. Plan finished 2026-04-24. (8a migration applied ✓, 8b API routes created, 8c services done, 8d model updated, 8e providers+screens+router done, 8f l10n done). Remaining: verify `flutter analyze` clean, update milestone doc, run `npm run build` for web-admin. Canonical tracker: `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`. Canonical tracker: `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`.

## Context

All 7 original milestones are marked "Completed" in the milestone tracker, but production-readiness work added a Riverpod migration, tenant discovery, token refresh, and more. This plan closes the remaining architectural gaps in dependency order.

---

## Gaps Being Fixed

| # | Gap | Severity |
|---|-----|----------|
| 1 | State management is ChangeNotifier — must be Riverpod | **Addressed** — customer app on Riverpod (Phases 1–2) |
| 2 | `mobile_testkit/test_app_wrapper.dart` missing | **Addressed** — `TestAppWrapper` + 9 tests green in `apps/customer_app` |
| 3 | Home screen is a 70-line placeholder | HIGH (Phase 5 pending) |
| 4 | No profile screen, no logout confirmation | HIGH (Phase 6 pending) |
| 5 | Token refresh on 401 | **Addressed** — `MobileHttpClient.onSessionRefresh` + `POST /api/v1/public/customer/auth/refresh` via `AuthApiService.refreshSession` (Phase 3) |
| 6 | Weak input validation (phone, OTP, booking notes) | MEDIUM |
| 7 | Some cards use hardcoded colors instead of AppColors | MEDIUM |
| 8 | AppConfig silently falls to demo mode in prod builds | **Addressed in prod** — `assertProductionReady()` (no `TENANT_ORG_ID` dart-define in prod) |
| 9 | Error message keys not audited vs l10n map | LOW (Phase 7) |
| 10 | No password login option — OTP-only forces SMS every login | HIGH (Phase 8) |
| 11 | Single-tenant `TENANT_ORG_ID` in build | **Addressed** — runtime tenant via slug + `tenantProvider` (Phase 0b) |

---

## Phase 0: Foundation — Dependencies + AppConfig Fail-Fast

**Goal:** Wire Riverpod into the dependency graph. Make prod builds fail-fast on missing config.

### Files to change:

**`apps/customer_app/pubspec.yaml`**
- Add `flutter_riverpod: ^2.5.1` to `dependencies`
- Confirm `provider` package is NOT present (it isn't currently — keep it out)

**`packages/mobile_core/lib/src/app_config.dart`**
- Add `assertProductionReady()` method: in prod, throws if `apiBaseUrl` is missing (tenant is no longer a dart-define)

**`apps/customer_app/lib/main.dart`**
- Wrap `runApp` in `ProviderScope`
- Call `AppConfig.fromEnvironment().assertProductionReady()` before `runApp`

---

## Phase 0b: Tenant Discovery — Runtime Multi-Tenancy

**Goal:** Remove `TENANT_ORG_ID` from dart-define. Tenant is resolved at runtime via QR scan or manual code entry, remembered across launches so returning customers skip the step.

### Architecture

```
App launch
    ↓
SessionManager.restoreTenant()
    ├── Found → "Welcome back to {tenantName}?" screen
    │       ├── Yes  → skip discovery, go to login/home
    │       └── No   → go to TenantDiscovery screen
    └── Not found → TenantDiscovery screen
            ├── [Scan QR]       → camera → decode tenantSlug → resolve via API
            └── [Enter code]    → text field → resolve via API
                    ↓
            TenantModel saved to secure storage
                    ↓
            Login / Guest entry
```

---

### Phase 0b-i: Backend API Route (web-admin)

**New route: `GET /api/v1/public/tenant/resolve`**
- Auth: None
- Query param: `slug` (e.g. `cleanwave`, `freshco`)
- Response (200):
```json
{
  "success": true,
  "data": {
    "tenantOrgId": "uuid",
    "name": "CleanWave Laundry",
    "name2": "كلين ويف للغسيل",
    "logoUrl": "https://...",
    "primaryColor": "#1A73E8"
  }
}
```
- Response (404): `{ "success": false, "error": "Laundry not found" }`
- QR code format: encodes `slug` only (e.g. `cmx://t/cleanwave`) — server owns the rest

**New column needed in `sys_org_mst` (or equivalent tenant table):**
- `slug VARCHAR(50) UNIQUE` — short human-readable identifier
- New migration: `0244_sys_org_slug.sql`
  ```sql
  ALTER TABLE sys_org_mst ADD COLUMN IF NOT EXISTS slug VARCHAR(50);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_org_mst_slug ON sys_org_mst (slug);
  COMMENT ON COLUMN sys_org_mst.slug IS 'URL/QR-safe short identifier for tenant discovery';
  ```
> **STOP — create file only, ask user to review and apply.**

---

### Phase 0b-ii: Mobile Domain Model

**New file: `packages/mobile_domain/lib/src/tenant_model.dart`**
```dart
class TenantModel {
  final String tenantOrgId;
  final String name;
  final String? name2;
  final String? logoUrl;
  final String? primaryColor;
  // fromJson / toJson / copyWith
}
```

---

### Phase 0b-iii: AppConfig Changes

**`packages/mobile_core/lib/src/app_config.dart`**
- Remove `tenantOrgId` from dart-define fields
- Keep only: `appEnv`, `apiBaseUrl`, `enableDebugLogs`
- `API_BASE_URL` is still dart-define (the web-admin URL — same for all tenants)
- `assertProductionReady()` no longer checks for `TENANT_ORG_ID`

---

### Phase 0b-iv: Mobile Services

**`packages/mobile_services/lib/src/tenant_service.dart`** ← NEW FILE
```dart
class TenantService {
  Future<TenantModel> resolveBySlug(String slug) async {
    // GET /api/v1/public/tenant/resolve?slug=cleanwave
    // Returns TenantModel or throws TenantServiceException
  }
  TenantServiceException on 404 → 'tenant.notFoundError'
}
```

**`packages/mobile_services/lib/src/session_manager.dart`** — extend to persist tenant:
- Add `restoreTenant()` → returns `TenantModel?`
- Add `saveTenant(TenantModel)` → stored in secure storage under key `'cmx_tenant'`
- Add `clearTenant()` — called on "choose different laundry"

All existing auth methods that previously read `config.tenantOrgId` now read from the resolved `TenantModel` passed at call time.

---

### Phase 0b-v: Flutter — New Screens & Providers

**New Riverpod provider: `tenant_provider.dart`**
```
TenantNotifier extends AsyncNotifier<TenantModel?>
tenantProvider → AsyncNotifierProvider<TenantNotifier, TenantModel?>
```
- `build()` → calls `sessionManager.restoreTenant()`
- `resolveBySlug(slug)` → calls `TenantService.resolveBySlug()` → saves → updates state
- `clearTenant()` → clears storage + resets state

**New screen: `customer_tenant_discovery_screen.dart`**
- Shows when no tenant is remembered
- Two options side by side: "Scan QR" button + "Enter code" text field
- "Scan QR" → uses `mobile_scanner` package → decodes `cmx://t/{slug}` → calls `resolveBySlug`
- "Enter code" → text field + "Find" button → calls `resolveBySlug`
- On resolve success → show `CustomerTenantConfirmScreen`
- Error state: "Laundry not found, check the code and try again" (localized)

**New screen: `customer_tenant_confirm_screen.dart`**
- Shown when a remembered tenant is found on launch
- Shows tenant name (`name` / `name2` based on locale) + logo if available
- Two buttons: "Yes, continue" → proceed to login/home | "Choose a different laundry" → go to discovery
- Also shown after a fresh resolution so customer confirms before proceeding

**New route additions in `app_route.dart` + `app_router.dart`:**
- `AppRoute.tenantDiscovery = '/tenant-discovery'`
- `AppRoute.tenantConfirm = '/tenant-confirm'`

**Shell controller bootstrap update (`app_shell_controller.dart`):**
- `bootstrap()` checks `tenantProvider` first:
  - No tenant → route to `AppRoute.tenantDiscovery`
  - Tenant found → route to `AppRoute.tenantConfirm` (returning user)
  - After tenant confirmed → proceed with session restore → normal auth routing

**All API service calls** — replace `config.tenantOrgId` with `ref.read(tenantProvider).value?.tenantOrgId`:
- `AuthApiService.requestOtp(tenantId: ...)`
- `OrderTrackingService.fetchOrderSummaries(session, tenantId: ...)`
- `OrderBookingService.loadBootstrap(session, tenantId: ...)`
- etc.

---

### Phase 0b-vi: QR Package

**`apps/customer_app/pubspec.yaml`**
- Add `mobile_scanner: ^5.1.0` (QR/barcode scanner)

QR code format the platform generates per tenant:
```
cmx://t/cleanwave
```
Parse the slug from the URI path after `/t/`.

---

### Phase 0b-vii: New l10n Keys (EN + AR)

```
tenant.discoveryTitle         → 'Find your laundry'           / 'ابحث عن مغسلتك'
tenant.scanQrAction           → 'Scan QR code'                / 'مسح رمز QR'
tenant.enterCodeAction        → 'Enter laundry code'          / 'أدخل رمز المغسلة'
tenant.codeHint               → 'e.g. cleanwave'              / 'مثال: cleanwave'
tenant.findAction             → 'Find'                        / 'بحث'
tenant.notFoundError          → 'Laundry not found. Check the code and try again.' / 'لم يتم العثور على المغسلة. تحقق من الرمز وأعد المحاولة.'
tenant.confirmTitle           → 'Welcome to {count}'          / 'مرحباً في {count}'
tenant.confirmAction          → 'Yes, continue'               / 'نعم، تابع'
tenant.chooseDifferentAction  → 'Choose a different laundry'  / 'اختر مغسلة أخرى'
tenant.scanningLabel          → 'Point camera at QR code'     / 'وجّه الكاميرا نحو رمز QR'
```

---

### Phase 0b — Verification

- [ ] Migration `0244` applies cleanly, `slug` column unique-indexed
- [ ] `GET /api/v1/public/tenant/resolve?slug=test` returns tenant data
- [ ] `GET /api/v1/public/tenant/resolve?slug=doesnotexist` returns 404
- [ ] Fresh install: discovery screen appears, QR scan resolves tenant
- [ ] Fresh install: manual code entry resolves tenant
- [ ] Wrong code shows localized error, does not crash
- [ ] After resolving: confirm screen shows tenant name in correct locale
- [ ] "Yes, continue" proceeds to login
- [ ] Second launch: confirm screen shows remembered tenant
- [ ] "Choose different laundry" → back to discovery, clears stored tenant
- [ ] All API calls pass resolved `tenantOrgId`, not a dart-define value
- [ ] `flutter analyze` clean

---

## Phase 1: Shell Controller — Riverpod Core

**Goal:** Replace `CustomerAppController` (raw class + StatefulWidget) and `CustomerAppScope` (InheritedNotifier) with three Riverpod providers. This is the highest-risk phase — all feature providers depend on it.

### Riverpod provider declarations (in `app_shell_controller.dart`):

```
customerSessionProvider     → AsyncNotifierProvider<CustomerSessionNotifier, CustomerSessionModel?>
customerLocaleProvider      → NotifierProvider<CustomerLocaleNotifier, Locale>
customerConnectivityProvider → NotifierProvider<CustomerConnectivityNotifier, bool>
```

### Files to change:

**`apps/customer_app/lib/core/app_shell_controller.dart`**
- Replace `CustomerAppController extends ChangeNotifier` → `CustomerSessionNotifier extends AsyncNotifier<CustomerSessionModel?>`
- Methods: `bootstrap()`, `signInWithPhone()`, `verifyOtpCode()`, `enterGuestMode()`, `clearSession()`, `updateToken()`
- Add `CustomerLocaleNotifier extends Notifier<Locale>` (locale switching)
- Add `CustomerConnectivityNotifier extends Notifier<bool>` (streams ConnectivityService)
- Delete `CustomerAppScope` (InheritedNotifier) entirely

**`apps/customer_app/lib/app.dart`**
- Convert `_CustomerAppState` → `ConsumerStatefulWidget` / `ConsumerState`
- Remove `AnimatedBuilder` over `_controller`
- Replace with `ref.watch(customerLocaleProvider)` for locale
- Add `ref.listen(customerSessionProvider, ...)` for navigation side-effects (offline, error, session cleared)
- Call `ref.read(customerSessionProvider.notifier).bootstrap()` in `initState`

**`apps/customer_app/lib/core/navigation/app_router.dart`**
- Remove constructor dependency on `CustomerAppController`
- Route guard reads `ref.read(customerSessionProvider)` and `ref.read(customerConnectivityProvider)` (pass `WidgetRef` via router wrapper or use `Consumer` in route builder)

---

## Phase 2: Feature Providers — Riverpod Rewrite

**Goal:** Rewrite all 5 feature providers. Must be done after Phase 1 (all depend on `customerSessionProvider`).

### Riverpod patterns per provider:

| Provider | Pattern | Reason |
|----------|---------|--------|
| `CustomerAuthNotifier` | `Notifier<CustomerAuthState>` | sync mutations + one async submit |
| `CustomerOtpNotifier` | `Notifier<CustomerOtpState>` | same |
| `CustomerOrdersNotifier` | `AsyncNotifier<List<OrderSummaryModel>>` | pure async fetch → AsyncValue |
| `CustomerOrderDetailNotifier` | `AsyncNotifierFamily<OrderDetailModel, String>` | keyed by orderNumber |
| `CustomerOrderBookingNotifier` | `Notifier<BookingState>` + async methods | wizard state is composite, not a single fetch |

### Files to change:

**Auth providers** (`customer_auth_provider.dart`, `customer_otp_provider.dart`)
- Introduce `CustomerAuthState` and `CustomerOtpState` value classes with `copyWith`
- Phone validation: upgrade to `RegExp(r'^\+?[0-9]{8,15}$')` (fixes GAP 6)
- OTP validation: enforce `RegExp(r'^[0-9]{6}$')` (fixes GAP 6)
- `submit()` calls `ref.read(customerSessionProvider.notifier).signInWithPhone(...)` / `verifyOtpCode(...)`

**Orders providers** (`customer_orders_provider.dart`, `customer_order_detail_provider.dart`)
- `AsyncNotifier.build()` auto-loads on first watch — remove manual `load(session)` in `initState`
- `build()` reads session via `ref.watch(customerSessionProvider.future)`
- UI switches to `.when(data:, loading:, error:)` pattern

**Booking provider** (`customer_order_booking_provider.dart`)
- Introduce `BookingState` value class (all current fields + `copyWith`)
- `Notifier<BookingState>` with async `load()` and `submit()` methods
- Notes max-length: enforce 500 chars in `updateNotes()` (fixes GAP 6)
- `load()` reads session via `ref.read(customerSessionProvider.future)`

**Auth screens** (`customer_login_entry_screen.dart`, `customer_otp_verification_screen.dart`)
- Convert to `ConsumerWidget`
- Remove `ChangeNotifierProvider(create: ...)` construction
- Read via `ref.watch(customerAuthProvider)` / `ref.watch(customerOtpProvider)`

**Orders screens** (`customer_orders_screen.dart`, `customer_order_detail_screen.dart`)
- Convert to `ConsumerWidget`
- Replace `AnimatedBuilder` + manual `load()` with `ref.watch` + `.when(...)`
- Pull-to-refresh: `ref.invalidate(customerOrdersProvider)`

**Booking screen** (`customer_order_booking_screen.dart`)
- Convert to `ConsumerStatefulWidget` (needs `initState` to call `ref.read(...).load()`)

---

## Phase 3: Token Refresh + HTTP Layer — **Done**

**Goal:** Wire the `/api/v1/public/customer/auth/refresh` path so a **401 on Bearer requests** triggers one shared refresh, session persistence, in-memory state update, and a **single retry** of the original call.

### Implemented (summary)

**`packages/mobile_services/lib/src/mobile_http_client.dart`**
- `onSessionRefresh: Future<CustomerSessionModel?> Function()?` (refresh uses a **plain** [no callback] `MobileHttpClient` from `AuthApiService` to avoid recursion)
- On 401: coordinated single-flight refresh; retry with new `Authorization` header; `session_expired` / l10n `common.sessionExpired` on failure or second 401

**`packages/mobile_services/lib/src/auth_api_service.dart`**
- `refreshSession(session:)` — `POST /api/v1/public/customer/auth/refresh` (already present)

**`apps/customer_app`**
- `core/providers/customer_api_client_providers.dart` — `customerApiHttpClientProvider` wires refresh via `SessionManager` + `customerAuthRepositoryProvider.refreshSession` + `applyRefreshedSession`
- `core/providers/network_providers.dart` — `plainHttpClientProvider` for auth API only
- `CustomerSessionFlowNotifier.applyRefreshedSession()` in `app_shell_controller.dart`
- Repositories: orders + booking use the session-aware `MobileHttpClient`
- L10n: `common.sessionExpired` (EN + AR)

---

## Phase 4: Test Migration — ProviderScope + Overrides

**Goal:** Make all 6 tests pass under Riverpod. Depends on Phase 2.

### Files to change:

**`packages/mobile_testkit/lib/src/test_app_wrapper.dart`** ← CREATE THIS FILE
```dart
class TestAppWrapper extends StatelessWidget {
  const TestAppWrapper({super.key, required this.child, this.overrides = const []});
  final Widget child;
  final List<Override> overrides;
  // Wraps with ProviderScope + MaterialApp + localizations + AppTheme
}
```
Also add to `mobile_testkit` exports:
- `FakeSessionNotifier` — `AsyncNotifier<CustomerSessionModel?>` returning preset session
- `fakeAuthenticatedSession` fixture
- `fakeGuestSession` fixture

**`packages/mobile_testkit/pubspec.yaml`**
- Add `flutter_riverpod` dependency

**All 6 test files** — migrate from ChangeNotifier construction to ProviderScope overrides:
- `test/auth/customer_login_entry_screen_test.dart` → override `customerAuthProvider`
- `test/orders/customer_orders_screen_test.dart` → override `customerOrdersProvider`
- `test/orders/customer_order_detail_screen_test.dart` → override `customerOrderDetailProvider`
- `test/booking/customer_order_booking_provider_test.dart` → `ProviderContainer`-based test
- `test/booking/customer_order_booking_screen_test.dart` → override `customerOrderBookingProvider`
- `test/core/customer_app_controller_test.dart` → `ProviderContainer` + override `ConnectivityService`

Remove all `CustomerAppScope(controller: ...)` wrappers from tests.

---

## Phase 5: Home Screen — Real Data + Booking CTA

**Goal:** Replace the 70-line placeholder with a real production home screen.

### Files to change:

**`apps/customer_app/lib/features/home/ui/screens/customer_home_screen.dart`**
- Convert to `ConsumerWidget`
- Greeting: `ref.watch(customerSessionProvider).value?.displayName ?? phoneNumber`
- Active orders badge: `ref.watch(customerOrdersProvider)` → count of non-completed orders
- Primary CTA: `AppCustomButtonWidget` "Book a new order" → `AppRoute.booking`
- Logout: show confirmation dialog before `ref.read(customerSessionProvider.notifier).clearSession()`
- Profile link: `IconButton` in AppBar → `AppRoute.profile`

**New l10n keys** (both EN and AR in `app_localizations.dart`):
- `home.greetingTitle` — `'Welcome back, {count}'`
- `home.bookNewOrderAction` — `'Book a new order'`
- `home.signOutConfirmTitle`, `home.signOutConfirmBody`, `home.signOutConfirmAction`, `home.signOutCancelAction`

---

## Phase 6: Profile Feature (New)

**Goal:** Add minimal profile screen — name, phone, sign out.

### New files:

**`apps/customer_app/lib/features/profile/ui/screens/customer_profile_screen.dart`**
- `ConsumerWidget`
- Reads `ref.watch(customerSessionProvider)` for displayName + phoneNumber
- `AppCardWidget` sections for each data item
- Sign-out with confirmation dialog → `ref.read(customerSessionProvider.notifier).clearSession()`
- All colors via `AppColors`, no hardcoded values

**`apps/customer_app/lib/core/navigation/app_route.dart`**
- Add `static const profile = '/profile'`

**`apps/customer_app/lib/core/navigation/app_router.dart`**
- Add `AppRoute.profile` → `CustomerProfileScreen`

**New l10n keys**: `profile.title`, `profile.phoneLabel`, `profile.nameLabel`, `profile.signOutAction`

---

## Phase 7: Polish — Colors Audit + L10n Key Audit

**Goal:** Eliminate hardcoded colors (GAP 7) and verify all errorMessageKey values exist in l10n (GAP 9).

### Files to change:

**`apps/customer_app/lib/features/home/ui/cards/customer_home_service_status_card.dart`**
- Replace any raw `Container(color: ...)` with `AppCardWidget` + `AppColors` references

**`apps/customer_app/lib/features/booking/ui/cards/customer_booking_option_card.dart`**
- Replace any hardcoded `Material(color: ...)` with `AppColors.surface` / `AppColors.primary`

**L10n audit**: cross-check every `errorMessageKey` string literal in providers against `_localizedValues['en']`. Fix any missing keys.

**Color audit**: `grep -r "Colors\." lib/` and `grep -r "Color(0x" lib/` — must return zero results outside `app_colors.dart` and `app_theme.dart`.

---

## Phase 8: Password Login Feature (New)

**Goal:** Let customers set an optional password after OTP verification, then log in with phone + password on future visits. OTP remains the primary registration and recovery path. Backend is authority — no password logic in the app.

### Architecture Decision

- Password is **optional** — customers who never set one keep using OTP
- OTP is required for first login and password reset (no SMS = no account access)
- `password_hash` stored in `org_customers_mst` (bcrypt, never plaintext) — tenant-scoped, RLS-protected
- Login screen offers both paths when a password exists for the phone number

---

### Phase 8a: Database Migration

**New migration** — next seq after `0242`: `0243_org_customers_password.sql`

```sql
ALTER TABLE org_customers_mst
  ADD COLUMN IF NOT EXISTS password_hash        TEXT,
  ADD COLUMN IF NOT EXISTS password_updated_at  TIMESTAMPTZ;

COMMENT ON COLUMN org_customers_mst.password_hash       IS 'bcrypt hash of customer password; NULL means OTP-only login';
COMMENT ON COLUMN org_customers_mst.password_updated_at IS 'When the customer last set or changed their password';
```

No default value. `NULL` means OTP-only — the app checks for this to decide which login options to show.

> **STOP — do not apply.** Create file, then ask user to review and apply.

---

### Phase 8b: Backend API Routes (web-admin Next.js)

**New route: `POST /api/v1/public/customer/password`** — Set or update password
- Auth: Bearer verification token (post-OTP, before or after session creation)
- Body: `{ tenantId, verificationToken, newPassword }` (min 8 chars, server-enforced)
- Action: bcrypt hash → store in `org_customers_mst.password_hash` + `password_updated_at`
- Response: `{ success: true, message: "Password set successfully" }`

**New route: `POST /api/v1/public/customer/login`** — Password-based login
- Auth: None (open endpoint)
- Body: `{ tenantId, phone, password }`
- Action: look up customer by phone + tenant, bcrypt compare
- Response (success): same shape as `/public/customer/session` — returns `CustomerSessionModel`
- Response (failure 401): `{ success: false, error: "Invalid phone or password" }`
- Rate limit: max 5 failed attempts per phone per 15 minutes (same table as OTP rate limiting)

**New route: `GET /api/v1/public/customer/auth-options`** — Check available login methods for a phone
- Auth: None
- Query: `tenantId`, `phone`
- Response: `{ hasPassword: boolean }` — app uses this to show/hide password login option
- Does NOT return any sensitive data — only a boolean flag

**Modified route: `POST /api/v1/public/customer/session`** — No change to interface, but password-login path also calls this to resolve full session after login succeeds

---

### Phase 8c: Mobile Services Package

**`packages/mobile_services/lib/src/auth_api_service.dart`** — add 3 new methods:

```dart
// Check if phone has a password set (to show/hide password login option)
Future<bool> checkHasPassword({
  required String phoneNumber,
  required String tenantId,
}) async { ... }  // GET /api/v1/public/customer/auth-options

// Login with phone + password
Future<CustomerSessionModel> loginWithPassword({
  required String phoneNumber,
  required String password,
  required String tenantId,
}) async { ... }  // POST /api/v1/public/customer/login

// Set or update password (called after OTP verification)
Future<void> setPassword({
  required String verificationToken,
  required String tenantId,
  required String newPassword,
}) async { ... }  // POST /api/v1/public/customer/password
```

---

### Phase 8d: Mobile Domain Models

**`packages/mobile_domain/lib/src/customer_session_model.dart`**
- Add `hasPassword` field: `final bool hasPassword` (default `false`)
- Update `fromJson` + `toJson`
- Used by login screen to decide whether to offer password option on next visit

---

### Phase 8e: Flutter — Auth Flow Changes

#### New provider: `customer_password_login_provider.dart`
```
CustomerPasswordLoginNotifier extends Notifier<PasswordLoginState>
```
State: `phoneNumber`, `password`, `isSubmitting`, `errorMessageKey`
- Phone validation: same `RegExp(r'^\+?[0-9]{8,15}$')`
- Password validation: min 8 chars
- `submit()` → `authRepository.loginWithPassword(...)` → `ref.read(customerSessionProvider.notifier).setSession(...)`

#### New provider: `customer_set_password_provider.dart`
```
CustomerSetPasswordNotifier extends Notifier<SetPasswordState>
```
State: `newPassword`, `confirmPassword`, `isSubmitting`, `isSuccess`, `errorMessageKey`
- Validation: min 8 chars, passwords match
- `submit()` → `authRepository.setPassword(verificationToken, newPassword)`

#### Modified: `customer_auth_provider.dart`
- After phone number entered, call `checkHasPassword()` and store `hasPassword` in state
- UI uses this flag to show "Continue with OTP" and optionally "Sign in with password"

#### Modified: `customer_login_entry_screen.dart`
- If `hasPassword == true`: show two buttons — "Sign in with password" + "Use OTP instead"
- If `hasPassword == false`: show only "Send OTP" (existing flow)
- Tapping "Sign in with password" → `AppRoute.passwordLogin`

#### New screen: `customer_password_login_screen.dart`
- Phone (pre-filled, read-only) + password field
- "Sign in" button → `CustomerPasswordLoginNotifier.submit()`
- "Forgot password? Use OTP" link → back to OTP flow
- Bilingual, all states (loading, error)

#### New screen: `customer_set_password_screen.dart`
- Shown after successful OTP verification (optional step before home)
- "Set a password for faster login" heading
- New password + confirm password fields
- "Set password" button + "Skip" link
- On success → navigate to home

#### Route additions in `app_route.dart` + `app_router.dart`:
- `AppRoute.passwordLogin = '/password-login'`
- `AppRoute.setPassword = '/set-password'`

#### Profile screen addition (Phase 6 extension):
- "Change password" option in profile → OTP verification first → `customer_set_password_screen.dart`
- Shows "Password login: enabled / not set" status

---

### Phase 8f: New l10n Keys (EN + AR)

```
auth.passwordLoginTitle          → 'Sign in with password'       / 'الدخول بكلمة المرور'
auth.passwordLabel               → 'Password'                    / 'كلمة المرور'
auth.passwordHint                → 'Enter your password'         / 'أدخل كلمة المرور'
auth.passwordMinLengthError      → 'At least 8 characters'       / '٨ أحرف على الأقل'
auth.passwordMismatchError       → 'Passwords do not match'      / 'كلمتا المرور غير متطابقتين'
auth.signInWithPasswordAction    → 'Sign in'                     / 'تسجيل الدخول'
auth.useOtpInsteadAction         → 'Use OTP instead'             / 'استخدام رمز التحقق'
auth.forgotPasswordAction        → 'Forgot password?'            / 'نسيت كلمة المرور؟'
auth.setPasswordTitle            → 'Set a password'              / 'تعيين كلمة مرور'
auth.setPasswordBody             → 'Log in faster next time without OTP' / 'سجل الدخول بسرعة دون رمز التحقق'
auth.setPasswordAction           → 'Set password'                / 'تعيين كلمة المرور'
auth.skipSetPasswordAction       → 'Skip for now'                / 'تخطي الآن'
auth.setPasswordSuccessMessage   → 'Password set successfully'   / 'تم تعيين كلمة المرور'
auth.confirmPasswordLabel        → 'Confirm password'            / 'تأكيد كلمة المرور'
auth.invalidPasswordError        → 'Incorrect phone or password' / 'الهاتف أو كلمة المرور غير صحيحة'
profile.passwordStatusEnabled    → 'Password login: enabled'     / 'الدخول بكلمة المرور: مفعّل'
profile.passwordStatusNotSet     → 'Password login: not set'     / 'الدخول بكلمة المرور: غير محدد'
profile.changePasswordAction     → 'Change password'             / 'تغيير كلمة المرور'
```

---

### Phase 8g: Docs to Update

**`cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`**
- Add Milestone 8 entry to the tracker table: "Password Login Feature — Planned"
- Add Milestone 8 section describing the hybrid OTP + password auth approach
- Update Milestone 4 notes to reference password as an opt-in extension

**`cmx_mobile_apps/packages/mobile_l10n/lib/src/app_localizations.dart`**
- Add all Phase 8f keys to both `'en'` and `'ar'` maps

---

### Phase 8 — Security Rules (Non-Negotiable)

- Password hashed with **bcrypt, cost factor >= 12** — never stored plaintext
- `password_hash` column never returned in any API response
- Rate limit password login: 5 failures per phone per 15 min → lock with clear error
- Minimum password length enforced **server-side** (client validation is UX only)
- No default passwords — system never generates or sets one
- Password reset requires OTP verification first — no email reset path (phone is the identity)
- `auth-options` endpoint returns only boolean — never leaks whether a customer exists

---

### Phase 8 — Execution Order Within Phase

```
8a (migration) → user applies → 8b (API routes) → 8c (services) → 8d (models)
    → 8e (Flutter screens/providers) → 8f (l10n keys) → 8g (docs)
```

---

### Phase 8 — Verification

- [ ] Migration applies cleanly, `password_hash` column nullable in `org_customers_mst`
- [ ] `POST /api/v1/public/customer/password` sets hash, verifiable via DB
- [ ] `GET /api/v1/public/customer/auth-options` returns `hasPassword: false` for new customer
- [ ] `GET /api/v1/public/customer/auth-options` returns `hasPassword: true` after password set
- [ ] `POST /api/v1/public/customer/login` succeeds with correct password
- [ ] `POST /api/v1/public/customer/login` returns 401 with wrong password
- [ ] 5 failed attempts locks the account for 15 minutes
- [ ] Login screen shows password option only when `hasPassword: true`
- [ ] Set password screen accessible after OTP verification (skippable)
- [ ] Skip → goes to home, no password stored
- [ ] Profile shows correct password status
- [ ] All new screens render in EN and AR without layout issues
- [ ] `melos analyze` clean after all 8e changes

---

## What NOT to Change

- `mobile_domain` models — clean, immutable, correct
- `mobile_l10n` l10n lookup mechanism
- `SessionManager` / `SessionStorage` abstractions
- Existing booking wizard step logic (`canProceed`, `goNext`, `goBack`) — moves 1:1 into `BookingState`
- `InMemorySessionStorage` — keep but use per-test instances in tests (`setUp(() => storage = InMemorySessionStorage())`)
- Demo mode fallback logic in services — keep for dev/test, just make prod builds assert config

---

## Execution Order

```
Phase 0   (deps + AppConfig — remove TENANT_ORG_ID dart-define)
    ↓
Phase 0b  (tenant discovery — migration + API + QR + confirm screen)
    ↓
Phase 1   (shell → Riverpod, bootstrap checks tenant first)
    ↓
Phase 2   (feature providers — all pass tenantOrgId from tenantProvider)
    ↓
Phase 3   (token refresh)  ─┐         ← parallel after Phase 2
Phase 4   (test migration) ─┘
    ↓
Phase 5   (home screen)               ← after Phase 1+2
Phase 6   (profile screen)            ← after Phase 1
    ↓
Phase 7   (polish + audit)
    ↓
Phase 8   (password login)            ← after Phase 6, migration first
```

---

## Phase Progress Tracker

| Phase | Title | Status | Notes |
|-------|-------|--------|-------|
| 0 | Foundation — Riverpod deps + AppConfig fail-fast | **Completed** | `ProviderScope`, `assertProductionReady()` |
| 0b | Tenant Discovery — runtime multi-tenancy | **Completed** | Slug API + `tenantProvider`; migration on `org_tenants_mst` |
| 1 | Shell Controller — Riverpod core | **Completed** | `customerSessionFlowProvider` + `customerLocaleProvider` |
| 2 | Feature Providers — Riverpod rewrite | **Completed** | Orders, detail, booking notifiers + screens |
| 3 | Token Refresh + HTTP Layer | **Completed** | `customerApiHttpClient` + 401 → refresh + retry; l10n |
| 4 | Test Migration — ProviderScope + overrides | **Completed** | 9 tests in `customer_app` |
| 5 | Home Screen — real data + booking CTA | **Completed** | Greeting, active orders count, booking CTA, profile icon, logout confirm dialog |
| 6 | Profile Feature | **Completed** | `CustomerProfileScreen` + `/profile` route + 4 l10n keys |
| 7 | Polish — colors audit + l10n key audit | **Completed** | Zero raw `Colors.`/`Color(0x` outside theme files; all error/message keys verified present in l10n map; `flutter analyze` 0 issues |
| 8 | Password Login Feature | **Completed** | API routes, service, providers, screens, l10n, analyze ✓, build ✓ |

---

## Documentation Update Requirements

Every phase that is marked complete MUST also update the following docs **in the same task** before being considered done.

### After Phase 0 completes
- `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
  - Add **Production-Readiness Phase 0** entry to the milestone tracker table

### After Phase 0b completes
- `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
  - Add **Production-Readiness Phase 0b** (Tenant Discovery) entry
  - Document the slug-based multi-tenancy architecture decision

### After Phase 1 completes
- `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
  - Add **Production-Readiness Phase 1** (Shell → Riverpod) entry
- `cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md`
  - Update state-management decision: ChangeNotifier → Riverpod migration complete

### After Phase 2 completes
- `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
  - Add **Production-Readiness Phase 2** (Feature Providers) entry
- Update validation status: all 6 tests should turn green after Phase 4

### After Phase 3 completes
- `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
  - Add **Production-Readiness Phase 3** (Token Refresh) entry

### After Phase 4 completes
- `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
  - Add **Production-Readiness Phase 4** (Test Migration) entry
  - Record test pass count before → after

### After Phase 5 completes
- `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
  - Update Milestone 7 Notes column: "Home screen now real data (Phase 5 complete)"

### After Phase 6 completes
- `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
  - Update Milestone 7 Notes column: "Profile screen added (Phase 6 complete)"

### After Phase 7 completes
- Run color and l10n audits, note zero-violation confirmation in milestone doc

### After Phase 8 completes
- `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
  - Add **Milestone 8: Password Login Feature** row to the tracker table with status Completed
  - Add Milestone 8 section (hybrid OTP + password auth approach, security rules)
  - Update Milestone 4 notes: reference password login as opt-in extension

---

## Verification Checklist

- [ ] `flutter pub get` succeeds in `customer_app`
- [ ] `melos analyze` passes with zero issues
- [x] `flutter test` — 9 tests green in `apps/customer_app` (as of 2026-04-24)
- [ ] App launches → splash → entry screen in both EN and AR
- [ ] OTP flow end-to-end with real API (or demo mode)
- [ ] Orders list loads, pull-to-refresh works
- [ ] Order detail screen shows timeline
- [ ] Booking wizard completes all 4 steps and submits
- [ ] Home shows customer name + active orders count
- [ ] "Book a new order" CTA navigates to booking
- [ ] Logout confirmation dialog appears before clearing session
- [ ] Profile screen shows name + phone
- [x] 401 on orders/booking → session refresh + retry (Phase 3; verify against live API)
- [ ] `grep -r "Colors\." lib/` returns zero results outside theme files
- [ ] No `print()` or `debugPrint()` in `lib/` or `packages/`
- [ ] Android release build succeeds
- [ ] Phase 8: password login flow works end-to-end (set, login, reset via OTP)
- [ ] Phase 8: 5-failure rate limit enforced on password login
- [ ] Phase 8: no password visible in any API response or log
