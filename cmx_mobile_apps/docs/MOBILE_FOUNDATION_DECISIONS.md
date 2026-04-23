# MOBILE_FOUNDATION_DECISIONS.md

---

## Document Metadata

| Field | Value |
|---|---|
| **Version** | v2.2.21 |
| **Date** | 2026-04-22 |
| **Status** | PROPOSED TARGET STATE |
| **Supersedes** | v1.0.0 |
| **Applies To** | Current mobile workspace under `cmx_mobile_apps/` and the planned mobile apps/packages described in this document |
| **Audience** | Mobile developers, AI assistants (Claude, Cursor, Codex), code reviewers, external contractors |
| **Enforcement** | Existing repository state is authoritative. LOCKED sections describe approved target architecture and become review gates only after the relevant module exists. |

### Changelog

| Version | Date | Summary |
|---|---|---|
| v2.2.21 | 2026-04-22 | Completed the repo-scoped Milestone 7 hardening baseline: added connectivity-aware offline routing, shared accessibility touch-target semantics, generated native Android and iOS customer-app targets, validated the Android release APK, and revalidated analysis, tests, and the `web-admin` production build |
| v2.2.20 | 2026-04-21 | Completed the Milestone 6 booking baseline: added a real public customer-booking API in `web-admin`, switched mobile booking to repository-backed remote/demo contracts, expanded booking UX states and tests, and revalidated mobile analysis/tests plus the `web-admin` production build |
| v2.2.19 | 2026-04-21 | Completed the Milestone 4 auth/session integration and Milestone 5 tracking integration baseline: added secure mobile session persistence wiring, repository-backed auth/tracking boundaries, public customer session and orders APIs in `web-admin`, expanded mobile tests, and revalidated the mobile app plus `web-admin` production build |
| v2.2.18 | 2026-04-18 | Aligned the auth widget test with the current phone-entry CTA copy so workspace test validation matches the implemented localized UI |
| v2.2.17 | 2026-04-18 | Fixed workspace test validation so `melos test` runs only in packages with real `test/` directories, and stabilized the initial widget tests to assert unique signals instead of duplicated headings |
| v2.2.16 | 2026-04-18 | Started early Milestone 7 work: upgraded `mobile_testkit` into a real localized/theme-aware test wrapper and added baseline widget tests for auth entry and orders list surfaces |
| v2.2.15 | 2026-04-18 | Started early Milestone 6 work: added a progressive order-creation flow skeleton with typed booking models, a booking service boundary, localized booking UI, and home-shell navigation into the first booking path |
| v2.2.14 | 2026-04-18 | Started early Milestone 5 work: added typed order-tracking models, a tracking service boundary, localized orders list/detail screens, and home-shell navigation into the first real customer tracking flow |
| v2.2.13 | 2026-04-18 | Extended early Milestone 4 implementation with explicit auth API and session-storage service contracts in `mobile_services`, and wired the customer app auth/session flow to those contracts instead of ad hoc state-only behavior |
| v2.2.12 | 2026-04-18 | Extended the early Milestone 4 auth flow from phone entry into a typed phone-plus-OTP shell with a dedicated verification route, localized OTP screens, and updated current-state documentation |
| v2.2.11 | 2026-04-18 | Milestone 3 shell is now complete at the documented baseline, and early Milestone 4 work has started with a typed session model, shared session manager API, protected-route handling, and a phone-entry auth shell |
| v2.2.10 | 2026-04-18 | Expanded early Milestone 3 implementation: `customer_app` now has an app controller, named-route shell, splash-to-entry initialization, guest and login entry screens, locale switching access, and baseline offline/error screens |
| v2.2.9 | 2026-04-18 | Fixed the customer app shell integration gap, split the initial home shell into feature-local cards, and added an app-local README so current implementation status is documented where the code lives |
| v2.2.8 | 2026-04-18 | Strengthened the documentation governance rule: mobile work is not considered complete until required documentation and roadmap or status updates are applied in the same task |
| v2.2.7 | 2026-04-18 | Updated current-state inventory for early Milestone 3 work: the customer app now has an initial localized home shell, and `mobile_ui` is expanding with canonical shared header and button widgets |
| v2.2.6 | 2026-04-18 | Updated current-state inventory for early Milestone 2 work: shared packages now contain initial core, theme, localization, service, domain, and testkit bootstrap code, and the customer app shell is wired to the shared foundation layer |
| v2.2.5 | 2026-04-18 | Added explicit documentation-maintenance rule to the mobile instruction layer: roadmap, current-state docs, rules, and implementation status must be updated as mobile work progresses |
| v2.2.4 | 2026-04-18 | Updated current-state inventory after Milestone 1 bootstrap start: `apps/` and `packages/` scaffold now exist with valid manifests and minimal shells, and mobile README guidance now reflects the active workspace |
| v2.2.3 | 2026-04-18 | Added enforceable mobile naming, nomenclature, UI consistency, shared-widget usage, and logging rules; normalized ambiguous suffixes such as `_vw.dart` and `_repo.dart` into clearer target-state conventions |
| v2.2.2 | 2026-04-18 | Added mobile governance alignment for the new local skill system: documented mobile skills, updated companion/inventory references, and reflected the instruction-layer upgrade in README, AGENTS.md, and CLAUDE.md |
| v2.2.1 | 2026-04-18 | Reclassified the document to truth-first target-state guidance: existing repo state now takes precedence, added current workspace inventory, corrected companion references, aligned examples with current files, and fixed stale section references |
| v2.2.0 | 2026-04-17 | Expanded §3.2 — pubspec.yaml ownership rules (LOCKED): each app and package owns its own pubspec, root is workspace manifest only, forbidden patterns, rationale |
| v2.1.0 | 2026-04-17 | Added §3.13 — Responsive Breakpoints and Layout Utility (LOCKED): AppBreakpoints, ResponsiveLayoutBuilder, LayoutBuilder-only rule, mobile/tablet/desktop thresholds |
| v2.0.0 | 2026-04-17 | Full rewrite — added 20 new sections: folder structure, networking, auth, routing, storage, error handling, logging, notifications, security, platform targets, multi-tenant isolation, CI/CD, testing, accessibility, dependency management, code review rules, governance, enforcement |
| v1.0.0 | 2026-04-10 | Initial draft — framework, state management, shared packages, build order |

### How to Read This Document

> If this document conflicts with the current repository, the repository wins. Use this document as the approved mobile target architecture unless a concrete implementation already exists on disk.

* **CURRENT STATE** — verified facts about the repository as it exists today.
* **LOCKED TARGET STANDARD** — approved architecture for future implementation. It cannot change without a filed ADR and tech lead approval.
* **RECOMMENDED STANDARD** — team default. It can be overridden in a feature with written justification in the PR and does not require an ADR.

### Current Mobile Workspace Inventory

**Verified on 2026-04-22**

| Area | Current State |
|---|---|
| Workspace root | `cmx_mobile_apps/` exists and is reserved for Flutter mobile work |
| Legacy top-level app folders | `customer_app/`, `staff_app/`, and `driver_app/` still exist as older placeholders |
| Active app workspace | `apps/customer_app`, `apps/staff_app`, and `apps/driver_app` now exist with valid `pubspec.yaml` files and minimal bootstrap shells |
| Customer app implementation | `apps/customer_app` now includes an app controller, session-aware named-route shell, localized splash/entry/home/offline/error screens, guest mode, a phone-plus-OTP auth shell backed by repository boundaries, secure runtime session persistence wiring, connectivity-aware offline recovery, localized orders list/detail tracking screens, a production-backed booking flow with fulfillment/address/slot/review states, feature-local home cards, generated native `android/` and `ios/` targets, and an app-local README documenting current scope |
| Auth service layer | `packages/mobile_services` now includes explicit auth API contracts, a mobile HTTP client, and secure-session storage support that back the current customer auth/session flow |
| Tracking service layer | `packages/mobile_services` now includes a real order-tracking integration path plus demo fallback, and `mobile_domain` now includes typed order summary/detail/timeline models for the first customer journey |
| Booking service layer | `packages/mobile_services` now includes remote and demo customer-booking bootstrap/submit contracts, and `mobile_domain` now includes typed service/address/slot/draft models for the first booking journey |
| Test layer | `packages/mobile_testkit` now wraps theme and localization for widget tests, and `apps/customer_app/test/` contains auth, booking, and orders automated coverage |
| Shared packages | `packages/mobile_core`, `mobile_ui`, `mobile_domain`, `mobile_services`, `mobile_l10n`, and `mobile_testkit` now exist with valid manifests and initial bootstrap code |
| Root manifest | `pubspec.yaml` exists and currently acts as the workspace manifest |
| Melos config | `melos.yaml` exists with `analyze`, `test`, `pub_get`, `format`, and `bootstrap` scripts |
| Mobile rules | `README.md`, `CLAUDE.md`, `AGENTS.md`, `.clauderc`, and `.cursor/rules/` exist |
| Mobile skills | `cmx_mobile_apps/.codex/skills/` now exists with Tier 1 mobile skills for architecture, foundation, UI system, customer UX, i18n/RTL, and testing |
| ADR location | `cmx_mobile_apps/docs/adr/` is not created yet |

**Interpretation**

* Today, this workspace contains a real bootstrap scaffold, shared foundation code, a customer shell with route structure plus OTP-backed auth/session wiring, customer-session, orders-list, and booking public backend contracts in `web-admin`, a real tracking journey baseline, a production-backed booking flow baseline, automated mobile coverage, and the documentation/rule layer.
* Any deeper feature implementation, package internals, CI pipeline detail, or widget catalog described later in this document should still be treated as target-state unless the repository already contains it.

---

## 1. Scope and Audience

### 1.1 What This Document Governs

* The current mobile workspace under `cmx_mobile_apps/`
* Planned app surfaces currently represented by `customer_app`, `staff_app`, and `driver_app`
* Proposed shared package boundaries such as `mobile_core`, `mobile_ui`, `mobile_domain`, `mobile_services`, `mobile_l10n`, and `mobile_testkit`
* Architectural decisions, technology choices, folder structure, naming conventions, and cross-cutting rules for future mobile implementation

### 1.2 What This Document Does NOT Govern

* `cmx-api` (NestJS backend) — governed by its own CLAUDE.md and standards
* `web-admin` (Next.js) — governed by the main CLAUDE.md
* Supabase schema or migrations — governed by the main CLAUDE.md

### 1.3 Companion Files

| File | Purpose |
|---|---|
| `cmx_mobile_apps/README.md` | Current-state repository notes; authoritative for whether mobile areas are planned vs implemented |
| `cmx_mobile_apps/CLAUDE.md` | AI coding rules — widget standards, model patterns, output format |
| `cmx_mobile_apps/AGENTS.md` | AI coding rules for Codex working in the mobile workspace |
| `cmx_mobile_apps/.codex/skills/` | Mobile-local skill set for architecture, Flutter foundations, UI system, customer UX, i18n/RTL, and testing |
| `cmx_mobile_apps/.clauderc` | Implementation guidance and prompt context, not proof of completed modules |
| `cmx_mobile_apps/.cursor/rules/` | Editor-side rule set currently present in the repository |
| `cmx_mobile_apps/melos.yaml` | Melos workspace configuration |
| `cmx_mobile_apps/pubspec.yaml` | Flutter workspace manifest |

### 1.4 AI Reading Contract

AI assistants working on mobile code must:

1. Confirm which sections of this document apply before generating code
2. Flag any gap requiring a Deferred Decision or ADR before proceeding
3. Distinguish current-state facts from target-state decisions when proposing architectural choices
4. Cite the current document version when it is relevant to the decision being made
5. State conflicts explicitly instead of silently following a stale path or structure example
6. Load the relevant local mobile skill from `cmx_mobile_apps/.codex/skills/` before writing mobile code
7. Update the appropriate mobile documentation whenever roadmap status, current-state facts, implementation status, or standing rules change
8. Treat the mobile task as incomplete until those required documentation and status updates are committed in the same work item

---

## 2. Non-Negotiable Principles

**Status: LOCKED TARGET STANDARD**

These are absolute rules with zero exceptions. Any deviation requires a new ADR and supersedes this document.

1. **Flutter and Dart exclusively** — no React Native, no KMM, no platform-native Swift/Kotlin outside encapsulated plugins
2. **Riverpod exclusively** — no Bloc, GetX, Provider package, MobX, or any other state management
3. **cmx-api exclusively** — mobile apps call `cmx-api` (NestJS) only; `supabase_flutter` is banned from all mobile code
4. **Feature-based folder structure** — no screen-based or flat layer-first structure anywhere
5. **Backend is the authority** — Flutter never enforces pricing, permissions, workflow transitions, or financial totals as source of truth
6. **No hardcoded UI text, colors, spacing, or styles** — ever, in any file
7. **EN and AR from day one, RTL from day one** — not retrofitted later
8. **All six shared packages are mandatory** — apps must not duplicate logic present in packages
9. **No code generation by default** — Freezed and build_runner require a documented ADR
10. **No circular dependencies** — packages may never depend on app code

---

## 3. Core Architecture Decisions

### 3.1 Framework

**Status: LOCKED TARGET STANDARD**

* Flutter SDK minimum: 3.24.x or later
* Dart SDK constraint: `>=3.5.0 <4.0.0`
* No platform-native Swift/Kotlin logic unless encapsulated as a Flutter plugin
* Plugin approval: same process as Section 21 (Dependency Management)

---

### 3.2 Monorepo Structure and `pubspec.yaml` Rules

**Status: CURRENT STATE + LOCKED TARGET STANDARD**

**Current state on 2026-04-18**

* The repository currently contains both legacy top-level app placeholder folders and an active `apps/` workspace
* `apps/customer_app`, `apps/staff_app`, and `apps/driver_app` exist with valid manifests and minimal shells
* `packages/` now contains the planned shared package directories with valid minimal manifests and exports
* Root [pubspec.yaml](../pubspec.yaml) is currently a workspace manifest
* Root [melos.yaml](../melos.yaml) currently defines `analyze`, `test`, `pub_get`, `format`, and `bootstrap`

**Locked target standard**

* Melos `^6.x` as workspace manager
* Preferred future layout uses `apps/` for app entry points and `packages/` for shared packages
* Planned shared packages: `mobile_core`, `mobile_ui`, `mobile_domain`, `mobile_services`, `mobile_l10n`, `mobile_testkit`
* Target Melos scripts: `analyze`, `test`, `format`, `pub_get`, `build:dev`, `build:staging`, `build:prod`

#### `pubspec.yaml` Ownership Rule (LOCKED TARGET STANDARD)

When the multi-app mobile workspace is implemented, every app and every package owns its own `pubspec.yaml`. This is non-negotiable for the target architecture.

```
cmx_mobile_apps/
  pubspec.yaml          ← workspace manifest ONLY. No Flutter deps. No app deps.
  apps/
    customer_app/
      pubspec.yaml      ← REQUIRED. Independent Flutter project.
    staff_app/
      pubspec.yaml      ← REQUIRED. Independent Flutter project.
    driver_app/
      pubspec.yaml      ← REQUIRED. Independent Flutter project.
  packages/
    mobile_core/
      pubspec.yaml      ← REQUIRED.
    mobile_ui/
      pubspec.yaml      ← REQUIRED.
    mobile_domain/
      pubspec.yaml      ← REQUIRED.
    mobile_services/
      pubspec.yaml      ← REQUIRED.
    mobile_l10n/
      pubspec.yaml      ← REQUIRED.
    mobile_testkit/
      pubspec.yaml      ← REQUIRED.
```

**Target root `pubspec.yaml`** contains only:

```yaml
name: cmx_mobile_apps_workspace
publish_to: none
environment:
  sdk: ">=3.5.0 <4.0.0"
dev_dependencies:
  melos: ^6.3.2
```

**Why this is non-negotiable:**

Flutter treats each app as a separate build target, a separate installable binary, a separate dependency graph, and a separate store submission. The three apps are not the same app with different screens — they are three independent apps that share code via packages. A single shared `pubspec.yaml` for all apps would make it impossible to build separate APK/IPA files, control permissions per app, give each app its own name/icon/bundle ID, or publish independently to app stores.

**Forbidden:**
- ❌ Apps depending on other apps
- ❌ Packages depending on apps
- ❌ App-specific dependencies placed in root `pubspec.yaml`
- ❌ Any attempt to merge app pubspecs into one file

**App dependency pattern** (each app's `pubspec.yaml`):

```yaml
dependencies:
  mobile_core:
    path: ../../packages/mobile_core
  mobile_ui:
    path: ../../packages/mobile_ui
  mobile_domain:
    path: ../../packages/mobile_domain
  mobile_services:
    path: ../../packages/mobile_services
  mobile_l10n:
    path: ../../packages/mobile_l10n
dev_dependencies:
  mobile_testkit:
    path: ../../packages/mobile_testkit
```

Melos is designed for exactly this layout — it reads each folder's own `pubspec.yaml` and orchestrates them. Running `melos bootstrap` is the first command after creating all folders.

---

### 3.3 Shared Packages — Canonical Responsibilities

**Status: LOCKED TARGET STANDARD**

| Package | Owns |
|---|---|
| `mobile_core` | AppException hierarchy, AppConfig (dart-define reader), AppLogger, base enums, formatters, extension methods, app-wide constants |
| `mobile_ui` | AppTheme, AppColors, AppSpacing, AppTextStyles, dark mode tokens, all reusable widgets (AppCardWidget, AppLoadingIndicator, AppErrorWidget, AppTextFieldWidget, AppCustomButtonWidget, AppDropdown, AppHeaderWidget, etc.) |
| `mobile_domain` | Shared domain entities and models — no Dio, no Hive imports allowed here |
| `mobile_services` | Dio HTTP client + interceptors, SessionManager, Hive storage, flutter_secure_storage, FCM/APNs service, offline pending queue, ConnectivityWrapper |
| `mobile_l10n` | EN and AR ARB files, AppLocalizations delegate, localeProvider, RTL utilities |
| `mobile_testkit` | MockSessionManager, FakeRepository, MockDioClient, ProviderContainerFactory, WidgetPumpHelper, GoldenTestHelper, FixtureFactory, PendingActionQueueFake |

No duplication of logic across apps is allowed.

---

### 3.4 Architecture Pattern

**Status: LOCKED TARGET STANDARD**

```
UI → Providers → Repository → Data Source (Remote via cmx-api | Local via Hive)
```

Rules:

* UI widgets call providers only — never repositories or data sources directly
* Providers hold async state via `AsyncNotifier` or `StateNotifier`
* Repositories abstract whether data comes from network, cache, or mock
* `RemoteDataSource` uses Dio to call `cmx-api`; `LocalDataSource` uses Hive
* Layer crossing is forbidden: no Dio import in a widget file, no widget import in a repository

---

### 3.5 State Management

**Status: LOCKED TARGET STANDARD**

* `flutter_riverpod` only
* `AsyncNotifier<T>` preferred for async features
* `StateProvider` for simple, local UI state only
* `setState` allowed only for: tab selection, local expand/collapse, temporary visual toggles — never for data fetching or shared state
* Provider naming: `{noun}{Verb}Provider` — e.g., `customerOrdersProvider`, `createOrderProvider`, `selectedBranchProvider`
* Forbidden names: `dataProvider`, `mainProvider`, `tempProvider`, `infoProvider`

---

### 3.6 Backend Authority

**Status: LOCKED TARGET STANDARD**

Backend (`cmx-api`) owns exclusively:

* Pricing calculations
* Workflow state transitions
* Permission grants
* Financial totals
* Order status

Flutter may: collect input, validate form structure (not business rules), display data, orchestrate API calls, queue offline intent.

Flutter must not: define final prices, approve workflow transitions independently, enforce permissions as authority, bypass backend validations.

---

### 3.7 Model Strategy

**Status: LOCKED TARGET STANDARD**

* Manual plain Dart classes are the default — no Freezed, no `json_serializable`, no `build_runner`
* Every model must implement: constructor, `fromJson`, `toJson`, `copyWith`, `==`, `hashCode`, `toString`
* Model naming: `{Domain}Model` in data layer, clean entity names in domain layer
* Forbidden across all layers: `dynamic`, `Map<String, dynamic>` as a primary model type flowing between layers
* Exception process: code generation requires a filed ADR and tech lead approval

---

### 3.8 Localization

**Status: LOCKED TARGET STANDARD**

* `flutter_localizations` (SDK built-in) + ARB-based loader in `mobile_l10n`
* ARB files: `app_en.arb` and `app_ar.arb` in `packages/mobile_l10n/lib/l10n/`
* Banned packages: `easy_localization`, `flutter_intl`, `intl_utils`
* Every new UI string gets an ARB key immediately — never hardcoded first, localized later
* Arabic keys must ship alongside English keys — PRs with missing AR keys are blocked
* Key naming: `{feature}.{component}.{purpose}` — e.g., `orders.list.emptyState`, `auth.login.submitButton`
* Currency display follows GCC locale conventions

---

### 3.9 Theming

**Status: LOCKED TARGET STANDARD**

* Single `AppTheme` class in `mobile_ui` — one light `ThemeData`, one dark `ThemeData`
* `AppColors` — all color tokens including dark variants; no hardcoded `Color(0xFF...)` in feature code
* `AppTextStyles` — all text scale levels; no inline `TextStyle(fontSize: x)` in feature code
* `AppSpacing` — constants: `xs=4`, `sm=8`, `md=16`, `lg=24`, `xl=32`, `xxl=48`
* Dark mode: all new UI must be tested in both light and dark modes
* Theme extensions: CleanMateX-specific tokens (e.g., order status colors) via Flutter ThemeExtension

---

### 3.10 Reusable Components

**Status: LOCKED TARGET STANDARD**

* Shared widget catalog lives in `mobile_ui`
* Required widgets (minimum): `AppTextFieldWidget`, `AppCustomButtonWidget`, `AppCustomDateField`, `AppDatePickerButton`, `AppDropdown`, `AppCardWidget`, `AppCheckBoxListTileWidget`, `CustomSwitch`, `AppHeaderWidget`, `AppLoadingIndicator`, `AppErrorWidget`
* New shared widgets must be generic enough for 2+ use cases with no feature-specific logic
* Duplicate widgets are forbidden — check catalog before creating
* Do not create duplicate naming variants such as `AppCardWidgetWidget` or `AppHeaderWidgetWidget` when the canonical shared widget already exists

---

### 3.11 Offline Strategy

**Status: LOCKED TARGET STANDARD**

* All three apps must handle network unavailability — no crashes, no blank screens
* Pending action queue stored in Hive box `pending_actions` (see Section 8.3 for structure)
* Retry mechanism: exponential backoff — 5s, 15s, 60s, 5min, then fail with user notification
* Conflict resolution: backend wins — client queued action is rejected if backend state changed
* `ConnectivityWrapper` provider in `mobile_services` exposes `isOnline` to all providers
* Full sync engine is DEFERRED — see Section 23

---

### 3.12 App Priority Order

**Status: LOCKED TARGET STANDARD**

Development order:

1. Staff App
2. Driver App
3. Customer App

Rationale: operational control must be stable before customer-facing features ship. New shared package features needed by Staff App are prioritized first.

---

### 3.13 Responsive Breakpoints and Layout Utility

**Status: LOCKED TARGET STANDARD**

Establish the breakpoints utility **before building the first screen**. No screen may use raw `MediaQuery.of(context).size.width` comparisons directly — all layout decisions go through `AppBreakpoints`.

#### Canonical Breakpoints

| Name | Width Range | Typical Devices |
|---|---|---|
| `mobile` | < 600dp | Phones (portrait and landscape) |
| `tablet` | 600dp – 1024dp | Tablets, large phones landscape |
| `desktop` | > 1024dp | Tablets (large, landscape), foldables open |

#### Tool: `LayoutBuilder` (Built-in — no package)

The only approved resolution tool is Flutter's built-in `LayoutBuilder`. No third-party responsive layout package is permitted without a filed ADR.

`LayoutBuilder` is preferred over `MediaQuery` for layout decisions because it responds to the available space of the parent widget, not the full screen — making it composable and testable.

#### Target Implementation (lives in `mobile_ui` package once created)

**`packages/mobile_ui/lib/src/theme/app_breakpoints.dart`**

```dart
abstract class AppBreakpoints {
  static const double mobileMax = 600;
  static const double tabletMax = 1024;

  static bool isMobile(double width) => width < mobileMax;
  static bool isTablet(double width) => width >= mobileMax && width <= tabletMax;
  static bool isDesktop(double width) => width > tabletMax;

  static T resolve<T>(double width, {
    required T mobile,
    required T tablet,
    T? desktop,
  }) {
    if (isDesktop(width)) return desktop ?? tablet;
    if (isTablet(width)) return tablet;
    return mobile;
  }
}
```

**`packages/mobile_ui/lib/src/widgets/scaffold/responsive_layout_builder.dart`**

```dart
class ResponsiveLayoutBuilder extends StatelessWidget {
  const ResponsiveLayoutBuilder({
    super.key,
    required this.mobile,
    this.tablet,
    this.desktop,
  });

  final WidgetBuilder mobile;
  final WidgetBuilder? tablet;
  final WidgetBuilder? desktop;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        if (AppBreakpoints.isDesktop(width)) {
          return (desktop ?? tablet ?? mobile)(context);
        }
        if (AppBreakpoints.isTablet(width)) {
          return (tablet ?? mobile)(context);
        }
        return mobile(context);
      },
    );
  }
}
```

#### Usage Pattern in Screens

```dart
// In any screen — mobile layout required, tablet optional, desktop optional
ResponsiveLayoutBuilder(
  mobile: (_) => const _MobileLayout(),
  tablet: (_) => const _TabletLayout(),
)

// For single-value resolution (e.g., column count, padding)
LayoutBuilder(
  builder: (context, constraints) {
    final columns = AppBreakpoints.resolve<int>(
      constraints.maxWidth,
      mobile: 1,
      tablet: 2,
      desktop: 3,
    );
    return GridView.count(crossAxisCount: columns, ...);
  },
)
```

#### Rules

- **Mobile layout is mandatory** for every screen. Tablet and desktop are optional enhancements.
- **Never use raw `MediaQuery.of(context).size.width`** for layout branching — always go through `AppBreakpoints` or `ResponsiveLayoutBuilder`.
- `ResponsiveLayoutBuilder` and `AppBreakpoints` are exported from `mobile_ui` — no app may redefine its own breakpoint constants.
- Breakpoint thresholds (600dp, 1024dp) are locked. Changes require a filed ADR because they affect all three apps and the widget catalog golden tests.
- All `mobile_ui` golden tests include a **tablet size** (768×1024) snapshot in addition to the phone size (375×667).
- Staff App and Driver App must be **tablet-usable** (staff use tablets at reception desks). Customer App tablet layout is a recommended enhancement.

---

## 4. Folder and File Structure

**Status: LOCKED TARGET STANDARD**

### 4.1 Target Per-App Structure (identical across all three apps)

```
apps/{app_name}/
  lib/
    main.dart
    app.dart
    core/                        # app-level overrides only
      constants/
      router/
        app_router.dart
        app_routes.dart
      bootstrap/
        app_bootstrap.dart
    features/
      {feature_name}/
        data/
          models/                # feature-specific models
          repositories/
            {feature}_repository.dart          # abstract interface
            {feature}_repository_impl.dart     # concrete implementation
          datasources/
            {feature}_remote_datasource.dart   # Dio → cmx-api
            {feature}_local_datasource.dart    # Hive
        domain/                  # feature-specific use-case abstractions
        providers/
          {feature}_provider.dart
        ui/
          screens/
            {feature}_{action}_screen.dart
          widgets/
            {feature}_{purpose}_widget.dart
          cards/
            {feature}_{purpose}_card.dart
  test/
    features/
      {feature_name}/
        data/
        providers/
        ui/
  pubspec.yaml
```

### 4.2 Target Per-Package Structure (example: `mobile_services`)

```
packages/mobile_services/
  lib/
    mobile_services.dart         # barrel export
    src/
      http/
        dio_client.dart
        auth_interceptor.dart
        tenant_interceptor.dart
        logging_interceptor.dart
        retry_interceptor.dart
      auth/
        auth_service.dart
        session_manager.dart
        session_model.dart
      storage/
        hive_storage.dart
        secure_storage.dart
      notifications/
        fcm_service.dart
      offline/
        pending_action_queue.dart
        connectivity_wrapper.dart
  test/
  pubspec.yaml
```

### 4.3 File Naming Rules

* Screens: `{feature}_{action}_screen.dart`
* View-only composed sections: `{feature}_{purpose}_view.dart`
* Widgets (shared): `app_{purpose}_widget.dart`
* Widgets (feature): `{feature}_{purpose}_widget.dart`
* Cards: `{feature}_{purpose}_card.dart`
* Providers: `{feature}_provider.dart`
* DB services: `{model}_db_service.dart`
* Repositories: `{feature}_repository.dart` (interface) + `{feature}_repository_impl.dart` (concrete)
* PostgreSQL-specific repositories: `{feature}_postgres_repository.dart`
* Data sources: `{feature}_remote_datasource.dart`, `{feature}_local_datasource.dart`
* Models: `{domain}_model.dart`
* Reusable constants and app-level shared files: `app_{domain}.dart`

**Naming clarifications**

* Prefer full words over abbreviations in file names. Use `_view.dart` instead of `_vw.dart`.
* Prefer `_repository.dart` over `_repo.dart` for clarity and consistency with the rest of the mobile architecture.

### 4.4 Additional Rules

* One class per file — enforced
* Each feature has a barrel file: `{feature}.dart`
* Each package has a top-level barrel export
* No flat `lib/screens/` or `lib/widgets/` structures — feature-based only

### 4.5 Nomenclature Rules

* Classes: PascalCase
* Variables, functions, and methods: camelCase
* File and directory names: snake_case
* Environment variables: UPPERCASE
* Functions should start with a verb
* Boolean variables should read like booleans: `isLoading`, `hasError`, `canDelete`, `shouldRetry`
* Prefer complete words and correct spelling over local abbreviations
* Standard abbreviations are acceptable when well known: `API`, `URL`, `OTP`, `ID`
* Short loop or conventional variables are acceptable when obvious: `i`, `j`, `err`, `ctx`, `req`, `res`, `next`
* Avoid magic numbers; extract constants when a value is reused or meaningful to the domain or UI

---

## 5. Networking and API

**Status: LOCKED TARGET STANDARD**

### 5.1 HTTP Client

* **Dio only** — not the `http` package
* Dio client lives in `mobile_services/src/http/dio_client.dart`
* `supabase_flutter` is **banned** from all mobile apps and packages — Supabase is internal to `cmx-api`

### 5.2 Base URL Configuration

* Read from `AppConfig` which reads from `--dart-define` at build time
* Three environments: `DEV`, `STAGING`, `PROD` — see Section 15
* Never hardcode base URLs or load from runtime `.env` files

### 5.3 Required Interceptors (in execution order)

| Order | Interceptor | Responsibility |
|---|---|---|
| 1 | `AuthInterceptor` | Attaches `Authorization: Bearer {token}` from SessionManager; triggers token refresh on 401; forces logout if refresh fails |
| 2 | `TenantInterceptor` | Injects `X-Tenant-Id` header from active TenantSession on every request |
| 3 | `LoggingInterceptor` | Logs request/response in debug builds only; omits sensitive fields in staging/prod |
| 4 | `RetryInterceptor` | Retries idempotent GET requests up to 3 times on network errors with exponential backoff |

### 5.4 Timeout Configuration

* Connection timeout: 30 seconds
* Receive timeout: 30 seconds

### 5.5 Response Parsing

* Repositories parse `dio.Response` into typed models — never in UI
* All Dio exceptions caught in repository and mapped to `AppException` hierarchy (Section 9)

### 5.6 Pagination

* Cursor-based pagination preferred; all list endpoints must document `next_cursor` or `offset/limit`
* Lists must be designed for lazy loading from the start

### 5.7 File Uploads

* Dio `FormData` for multipart uploads (e.g., Driver App proof-of-delivery photos)

---

## 6. Authentication and Session

**Status: LOCKED TARGET STANDARD**

### 6.1 Auth Backend

* All auth flows go through `cmx-api` REST endpoints — `cmx-api` wraps Supabase Auth internally
* No direct Supabase Auth calls from mobile

### 6.2 Session Model

```dart
class SessionModel {
  final String accessToken;
  final String refreshToken;
  final String userId;
  final String tenantOrgId;
  final String role;
  final DateTime expiresAt;
}
```

### 6.3 Token Storage

* `flutter_secure_storage` exclusively — Android Keystore backed, iOS Keychain backed
* Never store tokens in Riverpod state, SharedPreferences, or Hive
* Key naming: `cmx_access_token`, `cmx_refresh_token`

### 6.4 Session Manager

* `SessionManager` class in `mobile_services/src/auth/`
* Provides: `currentSession`, `refreshSession()`, `clearSession()`
* `sessionProvider` in Riverpod — all auth-dependent providers watch this

### 6.5 Supported Roles

`admin`, `staff`, `driver`, `customer`, `b2b_operator`

Role determines which features are accessible — UI adapts, `cmx-api` enforces.

### 6.6 Guest Mode

* Customer App only — limited browsing without a session; order submission requires auth
* Staff App and Driver App: no guest mode — auth required at launch

### 6.7 Session Lifecycle

* Token refresh: `AuthInterceptor` triggers refresh on 401, replays original request
* Session expiry: force re-authentication if token age exceeds 7 days
* Auth event stream from `cmx-api` (polling or WebSocket if supported): logout events clear session and redirect to login via go_router

---

## 7. Routing and Navigation

**Status: LOCKED TARGET STANDARD**

### 7.1 Router Package

* `go_router` — unconditional; not Navigator 2.0 directly, not `auto_route`

### 7.2 Route Definition

* Each app has `AppRouter` in `apps/{app}/lib/core/router/app_router.dart`
* Route constants in `AppRoutes` class — e.g., `AppRoutes.orderDetail = '/orders/:id'`

### 7.3 Typed Parameters

* Use `GoRouterState.pathParameters` and `GoRouterState.extra`
* Pass IDs through routes — load entity in the destination screen via provider
* Never pass raw mutable models through routes

### 7.4 Route Guards

* `GoRouter.redirect` checks `sessionProvider` — unauthenticated users redirect to login
* Role-based redirect: redirect if user's role lacks access to a route

### 7.5 Nested Navigation

* `ShellRoute` for bottom nav bar in each app
* Each app defines its own shell with its own nav items

### 7.6 RTL-Aware Transitions

* `CustomTransitionPage`: slide from left in AR (`TextDirection.rtl`), from right in EN
* Error route: `GoRouter.errorBuilder` shows branded error page — not Flutter's default red screen

### 7.7 Deep Links

* Each app registers its scheme in `AndroidManifest.xml` and `Info.plist`
* Deep link paths validated against known `AppRoutes` — unknown schemes rejected

---

## 8. Local Storage

**Status: LOCKED TARGET STANDARD**

### 8.1 Two Storage Tiers

| Tier | Package | Used For |
|---|---|---|
| Secure | `flutter_secure_storage` | Auth tokens and sensitive credentials only |
| General | `hive` + `hive_flutter` | All other local persistence |

* No SharedPreferences — replaced by Hive
* No SQLite / drift — deferred (Hive covers MVP needs)

### 8.2 Hive Rules

* Box naming: `{tenantOrgId}_{purpose}` — e.g., `abc123_staff_cache`, `abc123_pending_actions`
* All Hive-stored objects must have a registered `TypeAdapter` — no raw `Map` in Hive
* Adapters registered in `mobile_services` package initialization before `runApp`
* Cache TTL: 15 minutes for list data, 5 minutes for detail data (configurable per repository)
* Hive boxes storing order data or customer PII must use `encryptionCipher` with key from `flutter_secure_storage`

### 8.3 Pending Action Queue Structure

```dart
class PendingAction {
  final String id;            // UUID v4
  final String actionType;    // enum string (e.g., 'create_order', 'confirm_delivery')
  final String payloadJson;   // JSON-encoded request body
  final String tenantOrgId;   // multi-tenant isolation
  final DateTime createdAt;
  final int retryCount;
  final String? lastError;
}
```

### 8.4 Storage Service Interface

```dart
abstract class AppStorage {
  Future<void> write(String key, String value);
  Future<String?> read(String key);
  Future<void> delete(String key);
}
// Concrete: HiveStorage, SecureStorage
```

---

## 9. Error Handling Standard

**Status: LOCKED TARGET STANDARD**

### 9.1 AppException Hierarchy

```
AppException (abstract)                    — in mobile_core/src/errors/
├── NetworkException
│   ├── TimeoutException
│   ├── NoConnectionException
│   └── ServerException                    — 5xx responses
├── AuthException
│   ├── UnauthorizedException              — 401
│   └── ForbiddenException                 — 403
├── ValidationException                    — 422, form failures
├── NotFoundException                      — 404
├── BusinessRuleException                  — backend rejected with business reason
├── StorageException                       — Hive read/write failures
└── UnexpectedException                    — catch-all
```

Each exception carries:
* `message` — localization key (user-facing)
* `code` — machine-readable string
* `originalError` — nullable, for logging only

### 9.2 Contracts

* Repositories: must never let raw Dio exceptions escape — always catch and rethrow as `AppException`
* Providers: catch `AppException` and surface `AsyncValue.error(exception, stack)` — UI renders from exception type
* Widgets: no `try/catch` in widget code — all error handling in providers or repositories
* `AppErrorWidget` in `mobile_ui` renders different UI per exception type (network vs auth vs validation)
* `ProviderObserver` implementation logs all `AsyncValue.error` states via `AppLogger`

---

## 10. Logging Standard

**Status: RECOMMENDED STANDARD**

* Logger package: `logger` (pub.dev) in `mobile_core`
* `AppLogger` singleton wraps `Logger` — exposes `debug`, `info`, `warning`, `error`, `critical`

| Environment | Log Levels Active |
|---|---|
| DEV | All (debug and above) |
| STAGING | info and above |
| PROD | warning and above — no PII |

**Must always log:** provider state transitions (via ProviderObserver), AppException with stack trace, auth events, offline queue operations, push notification receipt

**Must never log in PROD:** tokens, passwords, payment data, personal phone numbers, full request bodies

* `print()` and `debugPrint()` are banned — use `AppLogger` only
* Crashlytics integration: DEFERRED — see Section 23

---

## 11. Push Notifications

**Status: LOCKED TARGET STANDARD**

* Platform: Firebase Cloud Messaging (FCM) for Android, APNs passthrough for iOS
* Package: `firebase_messaging` in `mobile_services`
* Each app registers its own FCM topic and handles its own payload types

### 11.1 Notification Payload Structure

```json
{
  "tenant_org_id": "string",
  "notification_type": "enum string",
  "target_entity_id": "string",
  "target_entity_type": "string"
}
```

### 11.2 Per-App Notification Types

| App | Types |
|---|---|
| Staff | `new_order`, `order_escalation`, `quality_flag`, `return_request` |
| Driver | `new_task`, `task_cancelled`, `task_updated`, `route_changed` |
| Customer | `order_status_change`, `promotion`, `delivery_arriving`, `order_ready` |

### 11.3 Lifecycle Rules

* Background handler: top-level function annotated `@pragma('vm:entry-point')`
* Foreground: `FirebaseMessaging.onMessage` → show in-app banner
* Tap: deep link into go_router route derived from `notification_type`
* Permission: request at meaningful moment — not on app launch
* FCM token: stored in user profile on `cmx-api`; refreshed on `onTokenRefresh`

---

## 12. Security

**Status: LOCKED**

* Token storage: `flutter_secure_storage` only — never SharedPreferences or Hive
* No API keys, secrets, or base URLs in source code — all via `--dart-define` or CI secrets
* Tokens must not be stored in Riverpod state — read from `SecureStorage` per request
* PROD builds: `flutter build` with `--obfuscate --split-debug-info` required
* Screenshot prevention: `FLAG_SECURE` (Android) on screens showing payment or PII data
* Deep link validation: reject unknown schemes via go_router route matching
* Session hard expiry: force re-auth after 7 days regardless of refresh token state
* Certificate pinning: DEFERRED — required before public PROD store release (see Section 23)
* Jailbreak/root detection: DEFERRED — post-MVP risk assessment (see Section 23)

---

## 13. Platform Targets and Performance

### 13.1 Platform Targets

**Status: LOCKED**

* Android minimum SDK: API 24 (Android 7.0)
* iOS minimum: iOS 14.0
* Phone-first at 360dp minimum width

### 13.2 Performance Standards

**Status: RECOMMENDED STANDARD**

* Frame target: 60fps (16ms budget per frame)
* First meaningful paint: under 2 seconds on mid-range Android
* `ListView.builder` mandatory for lists over 20 items; `SliverList` for complex scroll scenarios
* Prohibited patterns: synchronous file I/O on main isolate, heavy JSON parsing in build methods, `ListView` without `.builder`
* Image optimization: `cached_network_image`; max 2x device pixel ratio; WebP preferred; no asset over 500KB without justification
* Memory: dispose controllers and subscriptions in `dispose()`; prefer `AutoDispose` providers in Riverpod
* Tablet support: RECOMMENDED STANDARD — layouts must not break on 7-inch+ screens; full tablet optimization is DEFERRED

---

## 14. Multi-Tenant Isolation

**Status: LOCKED TARGET STANDARD — critical for CleanMateX**

* Every API request carries `X-Tenant-Id` header — enforced by `TenantInterceptor` in Dio
* `TenantSession` model: `tenantOrgId`, `tenantName`, `tenantLocale`, `tenantCurrency`, `tenantFeatureFlags`
* `tenantSessionProvider` in Riverpod — all data providers must `ref.watch(tenantSessionProvider)` before fetching
* Hive box naming is namespaced per tenant: `{tenantOrgId}_{purpose}` — prevents cross-tenant data leakage on shared devices
* Feature flags: tenant-level flags returned by `cmx-api` on session init, stored in `TenantSession.featureFlags`

### 14.1 Tenant Scope Per App

| App | Tenant Scope |
|---|---|
| Customer App | One tenant per install — determined by `--dart-define=TENANT_ORG_ID=xxx` at build time |
| Staff App | Tenant is the organization the user belongs to — resolved from `cmx-api` post-login |
| Driver App | Tenant is the delivery company linked to the user — resolved from `cmx-api` post-login |

### 14.2 Tenant Switching

* Scoped to Staff App and B2B operators only
* On tenant switch: clear all Hive boxes for previous tenant, reset all providers, reload session

### 14.3 Authority

* `cmx-api` enforces actual tenant isolation via Supabase RLS server-side
* `TenantInterceptor` is defense-in-depth — not the authority
* Forbidden: constructing API paths with hardcoded tenant identifiers — always read from `TenantSession`

---

## 15. Build Environments and CI/CD

**Status: LOCKED TARGET STANDARD**

### 15.1 Flavors

Three flavors: `dev`, `staging`, `prod`

Configuration via `--dart-define`:

```
APP_ENV=dev|staging|prod
API_BASE_URL=https://...
CMX_API_KEY=...
```

`AppConfig` in `mobile_core` reads all dart-define values at startup. Throws if required config is missing.

### 15.2 Per-Flavor Settings

* Android: `applicationIdSuffix` (`.dev`, `.staging`), `versionNameSuffix`
* iOS: separate Xcode schemes per flavor
* Debug logging: enabled in dev only (enforced by `AppConfig.isDev`)

### 15.3 CI Pipeline Steps (GitHub Actions)

Target pipeline once the mobile modules and scripts exist:

```
1. melos bootstrap
2. melos analyze              # zero warnings required
3. melos format --check       # rejects unformatted code
4. melos test                 # all packages
5. melos build:staging        # automated on main branch merge
6. melos build:prod           # manual trigger only
```

### 15.4 Code Signing

* Android: keystore via CI secrets — never committed to repo
* iOS: provisioning profiles via Fastlane Match or CI secrets

### 15.5 Release Rules

* PROD store release: manual trigger only — never automated
* Versioning: `version: {semver}+{buildNumber}` in pubspec — CI auto-increments build number
* Artifact naming: `{app}_{env}_{version}+{build}.apk/.ipa`

---

## 16. Package Dependency Rules

**Status: LOCKED TARGET STANDARD**

### 16.1 Dependency Graph

```
apps/customer_app  ─┐
apps/staff_app     ─┤──→ mobile_services ──→ mobile_domain ──→ mobile_core
apps/driver_app    ─┘──→ mobile_ui       ──→ mobile_core
                   └───→ mobile_l10n     ──→ mobile_core
                   └───→ mobile_domain   ──→ mobile_core
                   └───→ mobile_testkit  (test only)
```

### 16.2 Forbidden Dependencies

* Any package depending on app code
* `mobile_ui` depending on `mobile_services` or `mobile_domain`
* `mobile_domain` importing Dio, Hive, or any network/storage package
* `mobile_l10n` importing anything other than `mobile_core`
* Circular dependency between any two packages

### 16.3 Enforcement

* `melos analyze` catches most violations
* PR checklist includes dependency graph review (Section 22)

---

## 17. Build Order

**Status: LOCKED TARGET STANDARD**

| Step | Deliverable | Gate Condition |
|---|---|---|
| 1 | Workspace setup (Melos) | `melos bootstrap` passes, `melos analyze` passes |
| 2 | `mobile_core` | AppException, AppConfig, AppLogger, utilities complete |
| 3 | `mobile_l10n` | EN + AR ARB files, AppLocalizations delegate, localeProvider complete |
| 4 | `mobile_ui` | AppTheme, AppColors, AppSpacing, AppTextStyles, canonical widget catalog complete |
| 5 | `mobile_domain` | Shared models and entities covering cross-app concepts complete |
| 6 | `mobile_services` | Dio client + all interceptors, SessionManager, Hive storage, FCM, pending queue complete |
| 7 | `mobile_testkit` | Can build in parallel with step 6 |
| 8 | App shells | Router, bottom nav, auth gate, flavor config for all three apps |
| 9 | Authentication slice | Login, session restore, logout across all three apps |
| 10 | First vertical feature slice | Staff: order intake; Driver: task list; Customer: order creation |

**Gate:** No feature work starts before step 8 is complete.

**Gate:** No Customer App feature work starts before Staff App step 10 is stable.

---

## 18. App Responsibilities

**Status: LOCKED TARGET STANDARD**

### 18.1 Staff App

* **Primary users:** laundry facility staff, floor supervisors, QA personnel
* **Features:** order intake, processing stages (wash / dry / fold / iron / assemble), QA checks, issue flagging, returns, branch management
* **Unique tech needs:** barcode/QR scanner (`mobile_scanner`), stage-by-stage workflow screens, bulk order management
* **Offline criticality:** HIGH — staff must continue processing orders when network drops
* **Notifications:** `new_order`, `order_escalation`, `quality_flag`, `return_request`

---

### 18.2 Driver App

* **Primary users:** pickup and delivery drivers
* **Features:** assigned task list, route navigation, pickup confirmation, delivery confirmation (OTP + photo + signature), proof of delivery upload, task history
* **Unique tech needs:** maps (`flutter_map` or `google_maps_flutter`), camera (`image_picker`), signature pad, geolocation tracking
* **Offline criticality:** HIGH — delivery confirmation must work offline and sync on reconnect
* **Notifications:** `new_task`, `task_cancelled`, `task_updated`, `route_changed`

---

### 18.3 Customer App

* **Primary users:** individual customers, B2B-linked contacts, guest users
* **Features:** order creation, service selection, address management, order tracking, payment and receipts, loyalty history, notifications, profile, language toggle
* **Unique tech needs:** guest browsing mode, order tracking map, payment gateway (DEFERRED)
* **Offline criticality:** LOW — browsing acceptable offline; order submission requires connectivity
* **Notifications:** `order_status_change`, `promotion`, `delivery_arriving`, `order_ready`

---

## 19. Testing Standards

**Status: RECOMMENDED STANDARD**

### 19.1 Test Tiers

| Tier | Scope | Tool |
|---|---|---|
| Unit | Providers, repositories, AppException mappings, AppConfig | `flutter_test` + `mobile_testkit` |
| Widget | All screens (happy path + error + empty), modal dialogs | `flutter_test` + `WidgetPumpHelper` |
| Golden | All `mobile_ui` catalog components (light/dark, LTR/RTL) | `GoldenTestHelper` |
| Integration | Auth flow, first order creation flow per app — staging flavor | `flutter_test` integration |

### 19.2 `mobile_testkit` Contents

* `MockSessionManager` — fake session with configurable user/tenant/role
* `FakeRepository<T>` — generic fake accepting fixture data
* `MockDioClient` — interceptor-aware Dio mock
* `ProviderContainerFactory` — creates `ProviderContainer` with pre-configured overrides
* `WidgetPumpHelper.pump(widget, overrides)` — wraps in `ProviderScope`, `MaterialApp`, locale
* `GoldenTestHelper` — sets up golden test environment with theme, locale, device size
* `FixtureFactory` — static methods returning canonical model instances per domain entity
* `PendingActionQueueFake` — in-memory fake for offline queue tests

### 19.3 Coverage Targets (RECOMMENDED STANDARD)

* Providers: 80%
* Repositories: 70%
* UI screens: 60%

### 19.4 Test File Location

Mirrors source: `test/features/{feature}/...` mirrors `lib/features/{feature}/...`

---

## 20. Accessibility Standards

**Status: RECOMMENDED STANDARD — required before Customer App public release**

* `Semantics` labels on all interactive widgets: buttons, form fields, icons — label must use localized string
* Touch target minimum: 44×44 logical pixels — use `SizedBox` wrapper if widget is smaller
* Color contrast: WCAG AA minimum — 4.5:1 for normal text, 3:1 for large text — enforced in `AppColors` design tokens
* Screen reader support: TalkBack (Android) + VoiceOver (iOS) tested for all core flows
* `ExcludeSemantics` on purely decorative icons
* Focus order: `FocusTraversalGroup` for complex forms — especially important for RTL
* Reduced motion: respect `MediaQuery.disableAnimations` — disable heavy animations when enabled
* Font scaling: UI must not break at 1.5× and 2.0× text scale factor
* Arabic text: all AR content explicitly marked `TextDirection.rtl` — never auto-detected from content

---

## 21. Dependency Management

**Status: LOCKED TARGET STANDARD**

### 21.1 Approved Package List

| Category | Package |
|---|---|
| State management | `flutter_riverpod` |
| HTTP client | `dio` |
| Routing | `go_router` |
| Auth | via `cmx-api` REST — no `supabase_flutter` |
| Local storage | `hive`, `hive_flutter`, `flutter_secure_storage` |
| Notifications | `firebase_messaging` |
| Image | `cached_network_image`, `image_picker` |
| Scanner | `mobile_scanner` |
| Connectivity | `connectivity_plus` |
| Logging | `logger` |
| Maps (Driver App) | `flutter_map` or `google_maps_flutter` (to be decided per Driver App ADR) |

### 21.2 Process for Adding a New Package

1. Developer proposes in PR: package name, pub.dev score, last publish date, license, why existing packages cannot solve the need
2. Tech lead approves or rejects in PR review
3. Approved packages added to the relevant package's `pubspec.yaml` — not to app directly if it should be shared
4. Package added to approved list above

### 21.3 Banned Packages

`supabase_flutter`, `Freezed`, `build_runner`, `json_serializable`, `GetX`, `flutter_bloc`, `provider` (package), `easy_localization`, `flutter_intl`, `intl_utils`, `mobx`

### 21.4 Version Pinning

Use `^` for minor-safe pinning — no unpinned `any` dependencies.

Run `dart pub outdated` quarterly — packages over 2 major versions behind require an update plan.

---

## 22. Code Review Rules

**Status: LOCKED TARGET STANDARD**

### 22.1 Mandatory PR Checklist

Apply this checklist only to implemented mobile modules and packages that exist in the repository.

Before any PR can merge, all items must be checked:

- [ ] Follows feature-based folder structure (Section 4)
- [ ] No API/DB calls in UI widgets
- [ ] No hardcoded strings, colors, or spacing values
- [ ] AR localization keys provided alongside EN keys
- [ ] RTL layout tested or explicitly noted as not applicable
- [ ] Provider names follow naming convention (Section 3.5)
- [ ] `AppException` used for all error propagation
- [ ] New shared widgets checked against `mobile_ui` catalog — no duplication
- [ ] `X-Tenant-Id` header present via `TenantInterceptor` in any new API call
- [ ] `AppLogger` used — no `print()` or `debugPrint()` calls in committed code
- [ ] New dependency approved via Section 21 process
- [ ] Tests written per Section 19 minimums
- [ ] Dark mode tested for all new UI
- [ ] `flutter analyze` passes with zero warnings

### 22.2 PR Size Guideline

Prefer PRs under 400 lines changed. Large PRs must include an architecture note explaining the scope.

### 22.3 Branch Naming

`{app|pkg}/{type}/{short-description}` — e.g., `staff/feat/order-intake-screen`, `mobile_ui/fix/button-dark-mode`

### 22.4 Merge Strategy

Squash and merge into `main`. Commit message must follow Conventional Commits format.

### 22.5 Self-Merge

Never — minimum one reviewer required. Two required for changes to any shared package.

---

## 23. Deferred Decisions

These are intentionally postponed. Each item includes a trigger for when to revisit.

| Decision | Reason Deferred | Trigger to Revisit |
|---|---|---|
| Full offline sync engine | Post-MVP complexity | Order conflict rate exceeds 1% in staging |
| Certificate pinning | Pre-PROD infrastructure not finalized | Before public store release |
| Biometric authentication | Post-Customer-App-launch | Customer App ready for store submission |
| Jailbreak/root detection | Risk assessment not done | Security audit before PROD launch |
| Code generation (Freezed) | Manual models are clear and sufficient | Manual `copyWith` becomes unmaintainable at scale — team vote required |
| Full map service abstraction package | Driver App uses maps directly for MVP | Second app needs maps integration |
| White-label automation | Second tenant not onboarded | Second tenant contract signed |
| Crashlytics / Advanced analytics | Customer App not yet live | Before Customer App public launch |
| Payment gateway integration | Gateway contract not signed | Contract signed — placeholder stub required in Customer App in the meantime |
| Full tablet-optimized layouts | Phone-first MVP | Post-Customer-App stable release |

---

## 24. Governance and ADR Process

**Status: LOCKED TARGET STANDARD**

### 24.1 Changing This Document

* This document is version-controlled in git — all changes via PR
* **LOCKED section changes require:**
  1. ADR filed as `cmx_mobile_apps/docs/adr/{NNNN}-{slug}.md` once that folder is created, or in the team's active ADR location until then
  2. ADR reviewed and approved by: tech lead + at least one senior mobile developer
  3. Document version bumped (major version for LOCKED change, minor for RECOMMENDED STANDARD change)
  4. All AI assistant prompt files updated to reference the new version
* **RECOMMENDED STANDARD changes require:** PR with written justification, one reviewer approval

### 24.2 ADR Format

```markdown
# ADR-{NNNN}: {Title}

**Date:** YYYY-MM-DD
**Status:** PROPOSED | ACCEPTED | DEPRECATED | SUPERSEDED BY ADR-NNNN
**Deciders:** {names}

## Context
{What problem or situation prompted this decision?}

## Decision
{What was decided?}

## Consequences
{What are the positive and negative consequences?}

## Alternatives Considered
{What else was evaluated and why was it not chosen?}
```

### 24.3 ADR Numbering

Zero-padded four digits starting at `0001`. Sequential, never reused.

### 24.4 Quarterly Review

Tech lead reviews Section 23 (Deferred Decisions) each quarter for items ready to resolve.

---

## 25. Enforcement

**Status: LOCKED TARGET STANDARD**

### 25.1 Human Enforcement

* Section 22 PR checklist is mandatory — no exceptions, no bypass
* `flutter analyze` zero-warning policy: CI fails on any lint warning
* `dart format` enforced: CI rejects unformatted code via `melos format --check`
* Suppression annotations (`// ignore:`) require a justification comment in the same PR

### 25.2 AI Assistant Enforcement

All AI prompt sessions working on mobile code must:

1. Cite the current document version when using this file as an architectural reference
2. Confirm which sections apply before generating code
3. Flag any gap requiring a Deferred Decision or ADR before proceeding
4. Prefer the implemented repository structure whenever it conflicts with a target-state example in this document

**Prohibited AI behaviors:**

* Proposing alternative state management solutions
* Generating `print()` or `debugPrint()` statements
* Creating files outside the canonical folder structure (Section 4)
* Omitting `X-Tenant-Id` from any new API call
* Generating Freezed annotations or build_runner commands
* Importing `supabase_flutter` anywhere in mobile code
* Calling Supabase directly — all calls go through `cmx-api`
* Silently deviating from this document — must state the conflict explicitly

**Document precedence:** Existing repository state wins for current facts. This document governs approved target architecture. `cmx_mobile_apps/CLAUDE.md` and `cmx_mobile_apps/AGENTS.md` govern coding behavior for active work.

---

## 26. Guiding Principles

**Status: LOCKED TARGET STANDARD**

> **Build once in shared packages, reuse everywhere, and keep apps thin.**

> **The backend is the authority. Mobile is the interface.**

> **EN and AR are equal citizens. RTL is not an afterthought.**

These principles apply to every code review, every feature decision, and every architectural tradeoff in the CleanMateX mobile platform.

---
