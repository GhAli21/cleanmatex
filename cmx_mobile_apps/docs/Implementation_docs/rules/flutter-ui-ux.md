---
description: Flutter UI/UX and localization rules for CleanMateX mobile apps
globs:
  - "cmx_mobile_apps/apps/customer_app/lib/**/*.dart"
  - "cmx_mobile_apps/apps/staff_app/lib/**/*.dart"
  - "cmx_mobile_apps/apps/driver_app/lib/**/*.dart"
  - "cmx_mobile_apps/packages/mobile_ui/**/*.dart"
alwaysApply: true
---

# CleanMateX Flutter UI/UX Rules

## UX Principles

CleanMateX mobile apps are operational products, not design experiments.

Optimize for:
- Speed — low tap count, fast perceived response
- Clarity — clear visual hierarchy, purposeful use of space, minimal noise
- Touch friendliness — 44×44 logical pixel minimum touch target
- Consistency — same visual language across all screens
- Cognitive load reduction — show only what the user needs for the current action

Phone-first at 360dp minimum width. Never break on 7-inch+ screens.

## Design Tokens (mobile_ui)

All from `package:mobile_ui/mobile_ui.dart` — never hardcode:

- `AppTheme.light()` / `AppTheme.dark()` — MaterialApp theme (Material 3, `useMaterial3: true`)
- `AppColors.*` — color palette including dark variants
- `AppSpacing.*` — spacing scale: `xs=4`, `sm=8`, `md=16`, `lg=24`, `xl=32`, `xxl=48`
- `AppTextStyles.*` — typography

Always use `Theme.of(context).colorScheme` and `Theme.of(context).textTheme` in widgets — never hardcode colors, font sizes, radii, or spacing values.

Use Flutter `ThemeExtension` for CleanMateX-specific tokens (e.g., order status colors) — not ad-hoc inline colors.

## Localization

All strings live in `packages/mobile_l10n/lib/src/app_localizations.dart` in the `_localizedValues` inline map — no JSON files, no code generation.

```dart
final l10n = AppLocalizations.of(context);
Text(l10n.text('myFeature.title'))
Text(l10n.textWithArg('myFeature.paramExample', userName))
```

Key naming: `{feature}.{component}.{purpose}` — e.g., `orders.list.emptyState`, `auth.login.submitButton`

Rules:
- Every new key must include both EN and AR in the same commit — no EN-only PRs
- Arabic text is often longer than English — never make width assumptions based on English labels
- Avoid string concatenation for translated content — use `{placeholder}` substitution
- Dates, numbers, and currencies must be localized properly
- Error messages shown to users must map to localization keys — never show raw exception text

## RTL

`MaterialApp` in `app.dart` passes `locale` from `customerLocaleProvider` — RTL is applied automatically by Flutter's `Directionality` widget.

Do **not** hard-code `TextDirection.rtl` in individual widgets unless overriding a specific layout element.

All AR content must be explicitly marked `TextDirection.rtl` — never auto-detected from content alone.

```dart
final dir = AppLocalizations.of(context).textDirection;
```

Locale switching:
```dart
ref.read(customerLocaleProvider.notifier).toggleLocale();
```

RTL-aware navigation transitions: slide from left in AR, from right in EN (via `CustomTransitionPage`).

Arabic layout quality must equal English layout quality — test every screen in both locales.

## Responsive Layout

Use `AppBreakpoints` and `ResponsiveLayoutBuilder` from `mobile_ui` — never raw `MediaQuery.of(context).size.width` comparisons.

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

Mobile layout is mandatory. Tablet and desktop are optional enhancements. Breakpoint thresholds are locked — do not redefine them per-screen.

## Standard Widget Library (mobile_ui)

Always check `mobile_ui` before building a new widget. When a planned widget is needed, implement it in `mobile_ui` first, then consume it — never build a one-off inline version.

| Widget | Status | Purpose |
|---|---|---|
| `AppCardWidget` | ✅ exists | Elevated card shell with consistent padding/radius |
| `AppHeaderWidget` | ✅ exists | Screen / section header with title + optional subtitle |
| `AppCustomButtonWidget` | ✅ exists | Primary/secondary action button |
| `AppLoadingIndicatorWidget` | ✅ exists | Full-screen or inline loading state |
| `AppErrorWidget` | ✅ exists | Error state with message key + optional retry |
| `AppTextFieldWidget` | planned | Standard text input with label, hint, and validation |
| `AppDropdownWidget` | planned | Dropdown selector with label and consistent styling |
| `AppCustomDateFieldWidget` | planned | Date input field (typed entry) |
| `AppDatePickerButtonWidget` | planned | Tap-to-open calendar date picker |
| `AppCheckboxListTileWidget` | planned | Checkbox row with label and optional subtitle |
| `AppSwitchListTileWidget` | planned | Toggle/switch row with label |

New shared widgets must be generic enough for 2+ use cases — no feature-specific logic in `mobile_ui`.

## Screen States

Every non-trivial screen must handle all applicable states — no blank screens, no raw exception text:

| State | Required |
|---|---|
| Initial / loading | Always |
| Success (data) | Always |
| Empty | When the data set can be empty |
| Recoverable error | Always — with retry |
| Offline | When screen requires network data |

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

`AppErrorWidget` renders different UI per exception type (network vs auth vs validation).

## Dark Mode

Support `AppTheme.light()` and `AppTheme.dark()`. Always use `Theme.of(context).colorScheme` / `textTheme` — never hardcode colors. Test every new screen in both modes.

## Forms

- Validate client-side for obvious input errors; backend is the authority for business rules
- Preserve typed input on validation failure — never clear the form on error
- Prevent duplicate submits while a request is in progress
- Show field-level validation feedback when useful
- Split long forms into sections or steps

## Accessibility

- All interactive widgets must have `Semantics` labels using localized strings
- Minimum touch target: 44×44 logical pixels — wrap smaller widgets in `SizedBox`
- Color contrast: WCAG AA minimum — 4.5:1 for normal text, 3:1 for large text
- Never rely on color alone to convey status — pair with text or icon
- Use `ExcludeSemantics` on purely decorative icons
- Support `FocusTraversalGroup` for complex forms — especially important for RTL
- Respect `MediaQuery.disableAnimations` — disable heavy animations when enabled
- UI must not break at 1.5× and 2.0× text scale factor

## Operational UI (Staff / Driver Apps)

For staff/driver-style workflows:
- Prioritize one-hand use when possible
- Minimize typing — prefer scan/photo/location actions
- Make scan/photo/location actions fast and prominent
- Keep destructive actions clearly separated with confirmation
- Reduce modal overload
- Show current status and next required action clearly

## Visual Consistency

- Use shared theme tokens — no ad-hoc colors, font sizes, paddings, or radii
- Keep cards, buttons, text fields, and chips visually consistent across screens
- Use a single visual language across customer and staff/driver apps unless a feature explicitly needs distinct treatment

## UX Anti-Patterns

Reject:
- Blank screens or raw exception text on error
- Visually noisy screens
- Overuse of dialogs for non-critical confirmations
- Too many nested accordions
- Action buttons with unclear labels
- Icon-only destructive actions without labels or confirmation
- Hidden important actions behind obscure gestures
- Fixed-width assumptions that break in Arabic or large text scale
