# i18n Reference — CleanMateXSAAS Platform HQ

Use this only when examples are needed. Keep `SKILL.md` compact.

## 1. ICU Pluralization

```json
"selected": "{count, plural, one {# tenant selected} other {# tenants selected}}"
```

Arabic:

```json
"selected": "{count, plural, zero {لا يوجد مستأجرين محددين} one {مستأجر واحد محدد} two {مستأجران محددان} few {# مستأجرين محددين} many {# مستأجر محدد} other {# مستأجر محدد}}"
```

## 2. Shared Error Keys

```json
{
  "errors": {
    "loadFailed": "Failed to load data",
    "saveFailed": "Failed to save",
    "deleteFailed": "Failed to delete",
    "updateFailed": "Failed to update",
    "createFailed": "Failed to create",
    "networkError": "Network error occurred",
    "unauthorized": "Unauthorized access",
    "notFound": "Resource not found"
  }
}
```

Arabic must contain the same keys.

## 3. HTML Direction

```tsx
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
```

This is required for Tailwind `rtl:` utilities.

## 4. RTL Layout Examples

```tsx
<div className="text-left rtl:text-right" />
<div className="ml-4 rtl:ml-0 rtl:mr-4" />
<div className="pl-6 rtl:pl-0 rtl:pr-6" />
<div className="flex flex-row rtl:flex-row-reverse" />
<ChevronRight className="rtl:rotate-180" />
```

## 5. Locale Formatting

Date:

```typescript
new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
  year: 'numeric', month: 'long', day: 'numeric'
}).format(date)
```

Currency:

```typescript
new Intl.NumberFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
  style: 'currency', currency: 'OMR', minimumFractionDigits: 3
}).format(amount)
```

## 6. RTL Test Checklist

```text
- html dir switches for ar
- text aligns correctly
- forms align correctly
- tables align correctly
- navigation and breadcrumbs are correct
- directional icons rotate
- modals/dropdowns position correctly
- Arabic messages are present and readable
```

## 7. Troubleshooting

Missing translation: add missing key to the other locale file, then run `npm run check:i18n`.

RTL broken: check `<html dir>`, then inspect missing `rtl:*` classes.

Duplicate key: prefer existing `common.*` or feature namespace; remove duplicate if safe.
