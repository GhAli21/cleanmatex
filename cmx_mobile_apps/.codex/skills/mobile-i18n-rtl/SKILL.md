---
name: mobile-i18n-rtl
description: Bilingual English/Arabic and RTL implementation rules for CleanMateX mobile apps. Use when adding user-facing text, localization keys, RTL-aware layouts, or localized dates/numbers/currency in cmx_mobile_apps.
user-invocable: true
---

# Mobile i18n and RTL

Use this skill for mobile localization and RTL behavior.

## Read First

Read these before adding or reviewing user-facing text:

* `cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md`
* `cmx_mobile_apps/docs/Customer_app_01.md`
* `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`

## Core Rules

1. EN and AR ship together in the same commit — no EN-only PRs.
2. No hardcoded user-facing strings anywhere.
3. RTL must be explicitly reviewed, not assumed from content detection.
4. User-visible errors must be localized and human-readable.
5. Localized copy must fit the shared visual system without ad hoc per-screen styling hacks.
6. Arabic text is often longer than English — never make width or layout assumptions based on English label lengths.

## How AppLocalizations Works

All strings live in `packages/mobile_l10n/lib/src/app_localizations.dart` in the `_localizedValues` inline map.
There are **no JSON files** and **no code generation** — edit the map directly.

```dart
// Adding a new string: edit _localizedValues in app_localizations.dart
'en': {
  'myFeature.title': 'My Feature',
  'myFeature.subtitle': 'Short description here.',
  'myFeature.action': 'Do it',
  'myFeature.errorTitle': 'Something went wrong',
  'myFeature.paramExample': 'Hello {name}',
},
'ar': {
  'myFeature.title': 'ميزتي',
  'myFeature.subtitle': 'وصف مختصر هنا.',
  'myFeature.action': 'تنفيذ',
  'myFeature.errorTitle': 'حدث خطأ ما',
  'myFeature.paramExample': 'مرحباً {name}',
},
```

## Using Translations in Widgets

```dart
final l10n = AppLocalizations.of(context);  // no bang operator
Text(l10n.text('myFeature.title'))
Text(l10n.textWithArg('myFeature.paramExample', userName))
```

Never use `AppLocalizations.of(context)!` (with bang) — the method handles null internally.

## Key Naming

Format: `{feature}.{component}.{purpose}` — e.g., `orders.list.emptyState`, `auth.login.submitButton`, `common.retry`.

Prefer reusable `common.*` keys for shared UI patterns (retry, loading, error). Do not overload vague names like `common.text`.

## Locale Switching

```dart
ref.read(customerLocaleProvider.notifier).toggleLocale();
```

`MaterialApp` in `app.dart` receives `locale` from `customerLocaleProvider` — RTL is applied automatically by Flutter's `Directionality` widget.

## RTL Layout Rules

- Do NOT hard-code `TextDirection.rtl` in individual widgets unless overriding a specific layout element
- All AR content must be explicitly marked `TextDirection.rtl` — never auto-detected from content alone
- Get direction from: `final dir = AppLocalizations.of(context).textDirection;`
- RTL-aware navigation transitions: `CustomTransitionPage` slides left in AR, right in EN

Review every new layout for:

* Spacing and padding direction (start/end not left/right)
* Alignment and text flow
* Icon direction when meaning depends on direction (back arrows, forward arrows, chevrons)
* Truncation and wrapping under longer Arabic copy
* Form field label placement
* List item leading/trailing widget positions

Use `EdgeInsetsDirectional` and `AlignmentDirectional` instead of `EdgeInsets.only(left/right)` and `Alignment.centerLeft/centerRight`.

## Content Rules

Customer-facing copy should be:

* Short and scannable
* Clear and reassuring
* Free of backend jargon, branch names, and operational terminology
* Consistent in tone across EN and AR (not just translated)

Error messages: map to localization keys — never show raw exception messages, HTTP error strings, or stack traces.

## Formatting Rules

Explicitly handle:

* Dates — use locale-appropriate format (day/month/year in AR, month/day/year variants in EN)
* Times — AM/PM vs 24h based on locale
* Numbers — digit localization for Arabic (`٠١٢` vs `012`)
* Currency — amount + currency code, locale-appropriate decimal separator
* Status labels — localized, not raw backend enum strings

## Anti-Patterns

Reject these:

* English placeholders left in AR flows
* Hard-coded `TextDirection.rtl` scattered across feature screens
* `EdgeInsets.only(left: ...)` or `Alignment.centerLeft` in RTL-sensitive layouts
* Visually mirrored layouts with untranslated copy
* Backend error messages or exception `.toString()` exposed directly to the user
* Iconography pointing the wrong way in RTL (directional arrows)
* String concatenation for translated content — use `{placeholder}` substitution
* New localization keys with EN only — always add AR in the same commit
* `AppLocalizations.of(context)!` with bang operator

## Required Output

When using this skill, state:

1. The keys or text areas being added or changed
2. How EN and AR are both handled (both in same commit)
3. What RTL-sensitive layout areas were reviewed
4. How user-visible formatting (dates, numbers, currency) is localized

## Validation Checklist

- [ ] No hardcoded user-facing text remains
- [ ] EN and AR are both provided in the same commit
- [ ] RTL layout was reviewed explicitly — `EdgeInsetsDirectional` used where needed
- [ ] `AppLocalizations.of(context)` used (no bang operator)
- [ ] User-visible errors map to localization keys
- [ ] Dates, numbers, and currency are intentionally formatted
- [ ] `customerLocaleProvider` is the source for locale state — no ad hoc locale detection
