# i18n Style Guide

Developer style guide for CleanMateX translation keys and usage.

## Key Naming

- Use **camelCase** for all keys
- Keep keys **concise** and **descriptive**
- Avoid long key names; use nested structure instead

```json
// Good
"recordPayment": "Record payment"
"errors": { "loadFailed": "Failed to load" }

// Avoid
"recordPaymentForInvoiceAndOrder": "Record payment for invoice and order"
```

## Namespace Structure

- **common** — Shared UI keys (save, cancel, loading, etc.)
- **Feature-based** — orders, customers, invoices, payments, etc.
- Use nested keys for related groups: `orders.detail`, `payments.filters`

## When to Use Common vs Feature Keys

| Use common | Use feature |
|------------|-------------|
| save, cancel, delete, edit, create | orders.statuses.pending |
| loading, error, success | orders.preparation.errors.atLeastOneItem |
| search, filter, clearFilters | customers.types.guest |
| actions, status, date | newOrder.payment.methods.cash |

## Interpolation

Use `{placeholder}` format:

```json
"pageOf": "Page {page} of {totalPages}",
"ordersCount": "{count} orders",
"ordersSelected": "{count, plural, one {# order selected} other {# orders selected}}"
```

Common placeholders: `{count}`, `{page}`, `{totalPages}`, `{orderNo}`, `{resource}`

## Pluralization

Prefer ICU format over manual plural keys:

```json
"itemCount": "{count, plural, one {# item} other {# items}}"
```

Arabic supports: zero, one, two, few, many, other. For simple cases, `one` + `other` is often sufficient.

## Formatting

- **Date/currency:** Use `Intl.DateTimeFormat` and `Intl.NumberFormat` with `ar-OM` / `en-OM` locales
- Reference existing patterns in the i18n skill

## Validation Messages

Use `useTranslations('validation')` for **generic** form validation messages:

| Generic (use validation) | Feature-specific (use feature namespace) |
|--------------------------|------------------------------------------|
| `validation.required` — "This field is required" | `customers.firstNameRequired` — "First name is required" |
| `validation.invalidEmail` | `newOrder.validation.readyByRequired` |
| `validation.minLength` / `validation.maxLength` | `orders.preparation.errors.atLeastOneItem` |
| `validation.invalidPhone` | `customers.phoneRequiredStubFull` |

When adding new form validation: prefer `validation.*` for generic messages (required, invalidEmail, minLength); keep domain-specific messages in the feature namespace.

## Error Messages

- **Pattern:** `errors.loadFailed`, `errors.saveFailed`, `errors.deleteFailed`, `errors.notFound`
- **Parameterized:** Use `{resource}` when applicable: `"loadFailed": "Failed to load {resource}"`
- **Feature-specific:** Keep domain errors in feature namespace (e.g. `orders.preparation.errors.atLeastOneItem`)
- **Generic:** Use `common.error` or `validation.*` for generic messages

## Arabic-Specific

- **RTL:** Use Tailwind `rtl:` classes; test forms, tables, modals
- **Font:** Noto Sans Arabic for RTL body
- **Plural rules:** Arabic has 6 categories; use `one` + `other` for simplicity when acceptable

## Workflow

1. Search en.json and ar.json before adding keys
2. Reuse existing keys when possible
3. Update both en.json and ar.json
4. Run `npm run check:i18n` before committing
