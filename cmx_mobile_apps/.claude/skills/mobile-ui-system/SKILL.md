---
name: mobile-ui-system
description: Mobile design-system and screen-quality rules for CleanMateX Flutter apps. Use when building themes, reusable widgets, screen layouts, or loading/empty/error/offline/success states in cmx_mobile_apps.
user-invocable: true
---

# Mobile UI System

Use this skill for shared mobile UI, design tokens, and screen state patterns.

## Read First

Read these before building screens or reusable widgets:

* `cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md`
* `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
* `cmx_mobile_apps/docs/Customer_app_01.md`

## Core Rules

1. Public-facing mobile UI must feel intentional, simple, and trustworthy.
2. Shared visual rules belong in `mobile_ui` — never scattered across app screens.
3. Every shipped screen must define loading, empty, error, offline, and success behavior when applicable.
4. EN and AR must both look deliberate, not just functional.
5. Use canonical shared widget names — do not create duplicate suffix variants.
6. Always use `ConsumerWidget` or `ConsumerStatefulWidget` — never `StatefulWidget + Consumer` wrapper.
7. Always use `const` constructors and `super.key`.

## Design Tokens (All from `mobile_ui`)

```dart
import 'package:mobile_ui/mobile_ui.dart';
```

| Token | Type | Values |
|---|---|---|
| `AppTheme.light()` / `AppTheme.dark()` | MaterialApp theme | Material 3 (`useMaterial3: true`) |
| `AppColors.*` | Color palette | Includes dark-mode variants |
| `AppSpacing.*` | Spacing scale | `xs=4`, `sm=8`, `md=16`, `lg=24`, `xl=32`, `xxl=48` |
| `AppTextStyles.*` | Typography | — |

Always use `Theme.of(context).colorScheme` and `Theme.of(context).textTheme` in widgets — never hardcode colors, font sizes, radii, or spacing values.

Use Flutter `ThemeExtension` for CleanMateX-specific tokens (e.g., order status colors) — not ad-hoc inline colors.

## Canonical Shared Widget Names

All from `package:mobile_ui/mobile_ui.dart`. Check here before building a new widget.

| Widget | Status | Purpose |
|---|---|---|
| `AppCardWidget` | ✅ exists | Elevated card shell with consistent padding/radius |
| `AppHeaderWidget` | ✅ exists | Screen / section header with title + optional subtitle |
| `AppCustomButtonWidget` | ✅ exists | Primary/secondary action button |
| `AppLoadingIndicatorWidget` | ✅ exists | Full-screen or inline loading state |
| `AppErrorWidget` | ✅ exists | Error state with localized message key + optional retry |
| `AppTextFieldWidget` | planned | Standard text input with label, hint, validation |
| `AppDropdownWidget` | planned | Dropdown selector with label and consistent styling |
| `AppCustomDateFieldWidget` | planned | Date input field (typed entry) |
| `AppDatePickerButtonWidget` | planned | Tap-to-open calendar date picker |
| `AppCheckboxListTileWidget` | planned | Checkbox row with label and optional subtitle |
| `AppSwitchListTileWidget` | planned | Toggle/switch row with label |

When a planned widget is needed, implement it in `mobile_ui` first, then consume it — never build a one-off inline version.

New shared widgets must be generic enough for 2+ use cases — no feature-specific logic in `mobile_ui`.

## Screen State Pattern

Every non-trivial screen must handle all applicable states — no blank screens, no raw exception text:

| State | Required |
|---|---|
| Initial / loading | Always |
| Success (data) | Always |
| Empty | When the data set can be empty |
| Recoverable error | Always — with retry |
| Offline | When screen requires network data |

Standard implementation:

```dart
ordersAsync.when(
  data: (orders) => orders.isEmpty
      ? const _EmptyState()
      : _OrderList(orders: orders),
  loading: () => const AppLoadingIndicatorWidget(),
  error: (e, _) {
    final key = e is AppException ? e.messageKey : 'common.remoteRequestError';
    return AppErrorWidget(
      messageKey: key,
      onRetry: () => ref.invalidate(ordersProvider),
    );
  },
);
```

`AppErrorWidget` renders different UI per exception type (network vs auth vs validation) using the `messageKey` from the `AppException`.

## Responsive Layout

Use `AppBreakpoints` and `ResponsiveLayoutBuilder` — never raw `MediaQuery.of(context).size.width` comparisons.

| Breakpoint | Width | Devices |
|---|---|---|
| `mobile` | < 600dp | Phones |
| `tablet` | 600dp – 1024dp | Tablets, large phones landscape |
| `desktop` | > 1024dp | Large tablets, foldables |

```dart
ResponsiveLayoutBuilder(
  mobile: (_) => const _MobileLayout(),
  tablet: (_) => const _TabletLayout(),
)
```

Mobile layout is mandatory. Tablet and desktop are optional enhancements. Thresholds are locked — do not redefine per-screen.

## Dark Mode

Support `AppTheme.light()` and `AppTheme.dark()`. Test every new screen in both modes.

## Performance

- Use `ListView.builder` / `SliverList` — never `ListView(children: [...])` for dynamic data
- Mark leaf widgets `const` wherever possible
- Extract subwidgets to reduce rebuild scope
- Avoid expensive work inside `build()`
- Use `ref.select` to avoid rebuilds when only one field changes:
  ```dart
  final isLoading = ref.watch(ordersNotifierProvider.select((s) => s.isLoading));
  ```

## Accessibility

- Minimum touch target: 44×44 logical pixels — wrap smaller widgets in `SizedBox`
- Color contrast: WCAG AA — 4.5:1 for normal text, 3:1 for large text
- Never rely on color alone to convey status — pair with text or icon
- Use `ExcludeSemantics` on purely decorative icons
- All interactive widgets must have `Semantics` labels using localized strings
- UI must not break at 1.5× and 2.0× text scale factor

## Customer Quality Bar

For `customer_app`:

* First impression must communicate trust
* Main actions must be obvious with no competing CTAs
* Card hierarchy must be readable quickly
* Status labels must be visually distinct and accessible
* Spacing and rhythm must stay coherent in EN and AR

## Theme and Token Rules

Centralize in `mobile_ui`:

* Spacing and padding scale
* Typography
* Color palette including dark variants
* Surface treatments
* Order status colors (via `ThemeExtension`)
* Common corner radii and elevation

Do not hardcode any of these in feature screens.

## Reusable UI Rules

Create a shared widget in `mobile_ui` only when it is:

* Generic — works for 2+ use cases
* Not tied to any specific customer flow
* Not feature-specific

Keep feature-specific compositions in the app feature folders.

## Anti-Patterns

Reject these:

* Raw Material widgets used inconsistently across screens without wrapping
* One-off colors or text styles in feature files
* Dense ERP-style layouts in customer-facing screens
* Empty states without guidance (blank whitespace)
* Missing error state on screens that fetch remote data
* Duplicate widget naming: `AppCardWidgetWidget`, `AppLoadingIndicatorWidget` (suffix already in the name)
* Widget names that strip `Widget` suffix for shared components: `AppLoadingIndicator` (missing `Widget` suffix)
* `MediaQuery.of(context).size.width` comparisons — use `AppBreakpoints`
* Hardcoded `TextDirection.rtl` in individual widgets

## Required Output

When using this skill, state:

1. Whether the change belongs in `mobile_ui` or app-local UI
2. Which screen states are handled
3. How EN/AR and RTL were considered
4. How the design stays consistent with customer-facing quality goals

## Validation Checklist

- [ ] Shared visual rules centralized in `mobile_ui`
- [ ] Design tokens used — no hardcoded colors, sizes, fonts, or spacing
- [ ] All applicable screen states handled (loading/empty/error/success/offline)
- [ ] `AppLoadingIndicatorWidget` and `AppErrorWidget` used from `mobile_ui`
- [ ] No placeholder-grade public UI remains
- [ ] EN and AR layouts both tested
- [ ] Dark mode tested
- [ ] `const` constructors and `super.key` used throughout
- [ ] Touch targets ≥ 44×44 logical pixels
