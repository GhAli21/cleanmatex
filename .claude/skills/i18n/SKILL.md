---
name: i18n
description: Internationalization for English/Arabic bilingual support, RTL layout handling, next-intl usage. Use when adding UI text, translations, or RTL-aware layouts.
user-invocable: true
---

# Internationalization (i18n) & RTL

## CRITICAL Rules

1. **Always search for existing message keys** before adding new ones
2. **Always use common keys** for common messages (`tCommon()`)
3. **Update BOTH en.json and ar.json** when adding translations

## Translation Usage

```typescript
import { useTranslations } from 'next-intl';

export default function OrdersPage() {
  const tCommon = useTranslations('common');  // For common keys
  const t = useTranslations('orders');        // For feature keys

  return (
    <div>
      <h1>{t('title')}</h1>
      <button>{tCommon('save')}</button>
    </div>
  );
}
```

## Database Bilingual Pattern

```sql
name VARCHAR(250),       -- English
name2 VARCHAR(250),      -- Arabic
description TEXT,        -- English
description2 TEXT        -- Arabic
```

## RTL Support with Tailwind

```tsx
// Direction-aware spacing
<div className="ml-4 rtl:ml-0 rtl:mr-4">Content</div>

// Direction-aware alignment
<div className="text-left rtl:text-right">Text</div>

// Direction-aware flexbox
<div className="flex flex-row rtl:flex-row-reverse">
  <span>Item 1</span>
  <span>Item 2</span>
</div>

// Direction-aware icons
<ChevronRight className="rtl:rotate-180" />
```

## HTML Direction Setup

```tsx
// app/[locale]/layout.tsx
export default async function LocaleLayout({
  children,
  params: { locale }
}) {
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

## Translation File Structure

```json
// messages/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "search": "Search"
  },
  "orders": {
    "title": "Orders",
    "new": "New Order",
    "status": {
      "pending": "Pending",
      "processing": "Processing"
    }
  }
}

// messages/ar.json
{
  "common": {
    "save": "حفظ",
    "cancel": "إلغاء",
    "delete": "حذف"
  }
}
```

## Date & Currency Formatting

```typescript
import { useLocale } from 'next-intl';

function formatDate(date: Date): string {
  const locale = useLocale();

  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

function formatCurrency(amount: number): string {
  const locale = useLocale();

  return new Intl.NumberFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    style: 'currency',
    currency: 'OMR'
  }).format(amount);
}
```

## Font Setup for Arabic

```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap');

body[dir="rtl"] {
  font-family: 'Noto Sans Arabic', sans-serif;
}
```

## RTL Testing Checklist

- [ ] All text aligns correctly in Arabic
- [ ] Forms flow right-to-left
- [ ] Tables display correctly
- [ ] Navigation menus appear on correct side
- [ ] Icons face correct direction
- [ ] Modals and dropdowns position correctly

## Additional Resources

- See [reference.md](./reference.md) for complete i18n setup and examples
