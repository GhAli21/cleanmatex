---
name: i18n
description: Internationalization for CleanMateX web-admin, including EN/AR locale catalogs, next-intl usage, and RTL-safe UI patterns.
user-invocable: true
---

# Internationalization (i18n) & RTL

## CRITICAL Rules

1. Search existing keys first under `web-admin/messages/en/**` and `web-admin/messages/ar/**`.
2. Reuse `common.*` for generic UI actions, statuses, labels, and feedback.
3. Update both locale trees with identical file paths and identical leaf keys.
4. A namespace may be a file or a folder, never both.
5. Use `index.json` inside a namespace folder when root keys must stay at that namespace level.
6. Do not import locale JSON directly in components or feature code.
7. Load locale messages on the server; consume them through `next-intl`.
8. Run `npm run check:i18n` after translation changes.
9. Preserve RTL behavior for Arabic surfaces.
10. **Mandatory feedback API:** when showing user-facing success/error/warning/info/confirm feedback, resolve the i18n string first, then call `cmxMessage` or `useMessage()` from `@ui/feedback`. See `docs/dev/rules/cmx-message.md`. Do not use legacy toast helpers or `alert()` in new/edited feature code.

## Workflow Checklist

1. Search the locale tree for an existing key before adding a new one.
2. Add or update the matching locale files under `web-admin/messages/en/**` and `web-admin/messages/ar/**`.
3. Keep the namespace path stable unless you are fixing a real collision.
4. Use `useTranslations('namespace')` or `getTranslations('namespace')`.
5. Validate with `npm run check:i18n`.

## Locale Catalog Structure

```text
web-admin/messages/
  en/
    common.json
    orders.json
    workflow.json
    reports.json
  ar/
    common.json
    orders.json
    workflow.json
    reports.json
```

Rules:

- Keep the physical `en` and `ar` trees aligned.
- Keep `common` small and curated.
- Use deeper nesting only when a namespace file becomes too large.
- Use `index.json` inside a namespace folder when root keys must stay at that namespace level.

## Translation Usage

```typescript
import { useTranslations } from 'next-intl'

const tCommon = useTranslations('common')
const tOrders = useTranslations('orders')
```

## ICU And Placeholder Rules

- Prefer ICU for dynamic counts and structured placeholders.
- Placeholder names must match across locales.

Example:

```json
"ordersSelected": "{count, plural, one {# order selected} other {# orders selected}}"
```

## Error Message Conventions

- Generic errors: `common.errors.*`
- Feature-specific errors: `<feature>.errors.*`
- Parameterized strings: `"loadFailed": "Failed to load {resource}"`

## Validation

```bash
npm run check:i18n
cd web-admin && npx eslint . --quiet
npm run build
```
