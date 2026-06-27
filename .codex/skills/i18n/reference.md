# CleanMateX i18n Reference

## Key placement

- Shared UI words belong in `common.*`.
- Feature-specific copy belongs in that feature namespace.
- Avoid creating new top-level namespaces unless the repo already needs them.

## Locale catalog examples

```text
web-admin/messages/en/common.json
web-admin/messages/ar/common.json
web-admin/messages/en/orders.json
web-admin/messages/ar/orders.json
```

```json
// web-admin/messages/en/orders.json
{
  "title": "Orders",
  "status": {
    "pending": "Pending"
  }
}
```

```json
// web-admin/messages/ar/orders.json
{
  "title": "الطلبات",
  "status": {
    "pending": "قيد الانتظار"
  }
}
```

## RTL examples

```tsx
<div className="ml-4 rtl:ml-0 rtl:mr-4" />
<div className="text-left rtl:text-right" />
<ChevronRight className="rtl:rotate-180" />
```

## Locale formatting

```typescript
new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(date)
```

## Guardrails

- Keep the `en` and `ar` file trees aligned.
- Keep placeholders aligned across locales.
- Do not import locale JSON directly in React code.
- Fix duplicate namespace collisions by choosing either a file or a folder for that namespace root.
