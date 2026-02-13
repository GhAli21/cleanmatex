# 05 - Proxy Locale

## Summary

Proxy now reads locale from `NEXT_LOCALE` cookie or `Accept-Language` header instead of always using default.

## File(s) Affected

- `web-admin/proxy.ts`

## Code Before

```typescript
  const locale = defaultLocale // TODO: Get from user preferences
```

## Code After

```typescript
  const localeCookie = request.cookies.get('NEXT_LOCALE')?.value
  const locale =
    localeCookie && ['en', 'ar'].includes(localeCookie)
      ? localeCookie
      : request.headers.get('accept-language')?.toLowerCase().startsWith('ar')
        ? 'ar'
        : defaultLocale
```

## Effects

- Respects next-intl cookie for user preference
- Falls back to Accept-Language for Arabic
- Supports EN/AR bilingual as per project requirements
