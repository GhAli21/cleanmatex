# CleanMateX Flutter Mobile Architectural Context Report (`cmx_mobile_apps`)

**Date:** 24-04-2026  
**Prepared for:** External UI/UX consultant  
**Scope:** Architectural and UI context review for planning `mobile_ui` package refactoring

---

## 1) Workspace Structure

### Flutter monorepo summary tree (`cmx_mobile_apps`)

```text
cmx_mobile_apps/
├─ apps/
│  ├─ customer_app/                # Active implementation app
│  │  ├─ lib/
│  │  │  ├─ core/                  # app shell, routing, providers, dependency wiring
│  │  │  └─ features/              # auth, tenant, entry, guest, home, orders, booking, system...
│  │  ├─ test/
│  │  ├─ android/
│  │  └─ ios/
│  ├─ staff_app/                   # Bootstrap shell only at present
│  │  └─ lib/main.dart
│  └─ driver_app/                  # Bootstrap shell only at present
│     └─ lib/main.dart
├─ packages/
│  ├─ mobile_core/                 # AppConfig, AppLogger, AppException
│  ├─ mobile_domain/               # Shared typed domain models
│  ├─ mobile_services/             # HTTP/session/connectivity/service layer
│  ├─ mobile_ui/                   # Shared UI system (theme/tokens/widgets)
│  ├─ mobile_l10n/                 # Localization layer (EN/AR map + locale helpers)
│  └─ mobile_testkit/              # Shared testing wrappers/utilities
├─ docs/
├─ melos.yaml
└─ pubspec.yaml
```

### App placement clarity

- **Customer app location:** `cmx_mobile_apps/apps/customer_app`
- **Staff app location:** `cmx_mobile_apps/apps/staff_app`
- **Driver app location:** `cmx_mobile_apps/apps/driver_app`

Current implementation depth is heavily concentrated in `customer_app`; `staff_app` and `driver_app` are currently scaffold-level placeholders.

---

## 2) Dependencies & Architecture (Customer App)

Source reviewed: `cmx_mobile_apps/apps/customer_app/pubspec.yaml`

### Key packages by architecture concern

- **State management**
  - `flutter_riverpod: ^2.5.1`

- **Routing / navigation**
  - No external router package in dependencies.
  - Routing is implemented via Flutter `MaterialApp` + `onGenerateRoute` (`core/navigation/app_router.dart`) and route constants (`core/navigation/app_route.dart`).

- **API networking**
  - No direct `dio` dependency in `customer_app` pubspec.
  - Networking is consumed through shared workspace package `mobile_services` (service/client/repository boundaries are app + package based).

- **Localization**
  - `flutter_localizations` (Flutter SDK)
  - Shared package `mobile_l10n`

- **UI system**
  - Shared package `mobile_ui`

### Architectural characteristics in code

- Feature-first structure under `lib/features/*`.
- Cross-app foundations extracted into `packages/*` (good for reuse/refactorability).
- App bootstrap is state-driven (session + tenant + connectivity), then route guards determine entry path.

---

## 3) Current Theming & Styling

### Main theme configuration

- Central theme lives in:  
  `cmx_mobile_apps/packages/mobile_ui/lib/src/app_theme.dart`

- Token sources include:
  - `app_colors.dart`
  - `app_text_styles.dart`
  - `app_spacing.dart`

- App wiring confirms centralized usage:
  - `cmx_mobile_apps/apps/customer_app/lib/app.dart`
    - `theme: AppTheme.light()`
    - `darkTheme: AppTheme.dark()`

### Refactor readiness assessment

- **Strong baseline centralization exists** in `mobile_ui`.
- Shared widgets are actively used (`AppCardWidget`, `AppCustomButtonWidget`, `AppHeaderWidget`, etc.).
- However, there is still **leaf-level style drift** in feature files (local `TextStyle(...)`, explicit radii/sizes in some widgets).

**Conclusion:** The codebase is **not purely hardcoded inline styles**, but also **not fully token-pure** yet. It is in a good intermediate state for a focused `mobile_ui` hardening/refactor pass.

---

## 4) Localization (RTL/Arabic) Implementation

### Dynamic language system wiring

- Locale source-of-truth is in app shell:
  - `customerLocaleProvider` in  
    `cmx_mobile_apps/apps/customer_app/lib/core/app_shell_controller.dart`

- Toggle action is exposed via:
  - `cmx_mobile_apps/apps/customer_app/lib/features/common/ui/widgets/customer_locale_switch_widget.dart`

- MaterialApp locale binding:
  - `cmx_mobile_apps/apps/customer_app/lib/app.dart`  
    (`locale: ref.watch(customerLocaleProvider)`)

- Translation storage:
  - `cmx_mobile_apps/packages/mobile_l10n/lib/src/app_localizations.dart`
  - Inline EN/AR key map `_localizedValues` (JSON/codegen-free approach)

### RTL-safe layout patterns observed

- `AppLocalizations` exposes direction (`textDirection`) and Arabic locale is implemented.
- The app avoids explicit left/right hardcoding in most screens.
- **But** it currently relies primarily on neutral spacing (`EdgeInsets.all`, generic `Row`/`Column`) and does **not** show broad adoption of:
  - `EdgeInsetsDirectional`
  - `AlignmentDirectional`

**Conclusion:** Language switching and Arabic content are implemented, but directional layout primitives are not consistently used yet. This is a key area to include in the `mobile_ui` refactor plan.

---

## 5) Problematic UI Files (Customer Onboarding Flow)

The requested onboarding sequence maps to the following customer-app files:

### A) Landing Screen

- **Path:**  
  `cmx_mobile_apps/apps/customer_app/lib/features/entry/ui/screens/customer_entry_screen.dart`
- **Root layout stack:**  
  `Scaffold -> SafeArea -> Center -> ConstrainedBox -> ListView`
- **Overflow risk note:**  
  Low for vertical overflow because the primary content container is scrollable (`ListView`).

### B) Phone Number Entry

- **Path:**  
  `cmx_mobile_apps/apps/customer_app/lib/features/auth/ui/screens/customer_login_entry_screen.dart`
- **Root layout stack:**  
  `Scaffold -> SafeArea -> Center -> ConstrainedBox -> Padding -> AppCardWidget -> Column(mainAxisSize: min)`
- **Overflow risk note:**  
  High candidate for RenderFlex overflow on smaller heights / keyboard open / larger text scaling because the main content is a non-scroll `Column`.

### C) Laundry / Workspace Selection

- **Primary selection screen path:**  
  `cmx_mobile_apps/apps/customer_app/lib/features/tenant/ui/screens/customer_tenant_discovery_screen.dart`
- **Root layout stack:**  
  `Scaffold -> SingleChildScrollView -> Column`
- **Overflow risk note:**  
  Lower vertical overflow risk than phone entry due to explicit scroll container.

### Closely related step (post-selection confirmation)

- **Path:**  
  `cmx_mobile_apps/apps/customer_app/lib/features/tenant/ui/screens/customer_tenant_confirm_screen.dart`
- **Root layout stack:**  
  `Scaffold -> SafeArea -> Padding -> Column(centered)`
- **Overflow risk note:**  
  Moderate risk on small-height devices with larger text because content is centered in a non-scroll `Column`.

---

## Consultant-Oriented Refactor Signals for `mobile_ui`

Based on current architecture and UI implementation patterns:

1. **Refactor leverage is high** because shared UI already exists and is consumed broadly.
2. **Priority normalization targets:**
   - directional spacing/alignment primitives (RTL-safe by default),
   - form screen scaffolds that are keyboard + small-height resilient,
   - standardized responsive screen wrappers (scroll strategy + max width + safe area policy),
   - tokenizing residual one-off radius/typography/size values.
3. **Immediate overflow mitigation candidates** are onboarding/auth screens that still use non-scroll root `Column` compositions.

---

## Final Snapshot

- Monorepo structure is healthy for package-level UI refactoring.
- Customer app has meaningful architecture and feature depth; other mobile apps are still shell-level.
- Theming/localization foundations are in place, but directional and layout resilience consistency is incomplete.
- The identified onboarding file paths provide concrete starting points for fixing RenderFlex overflow and standardizing core `mobile_ui` contracts.
