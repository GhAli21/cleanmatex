# i18n Future Suggestions

Recommendations for future i18n work in CleanMateX.

## Split by Feature

When translation files exceed ~5,000 lines per locale, consider splitting by feature:

```
messages/
├── en/
│   ├── common.json
│   ├── orders.json
│   ├── customers.json
│   └── ...
└── ar/
    └── ...
```

Requires updating `i18n.ts` to merge multiple files.

## TypeScript Types from Keys

Generate types from message keys for autocomplete:

```typescript
type MessageKey = 'common.save' | 'common.cancel' | 'orders.title' | ...
```

Tools: `typesafe-i18n`, custom script, or `next-intl` type generation.

## CI Integration

Add to CI pipeline:

```yaml
- run: npm run check:i18n
```

Run on every PR to catch missing keys early.

## Translation Memory / Glossary

Maintain a glossary for terms used across the app:

- Order, Invoice, Payment, Customer, etc.
- Consistent terminology in EN and AR

## Third Language Support

If adding another locale (e.g. Urdu, Hindi):

- Add locale to `i18n.ts` locales array
- Create new `messages/[locale].json`
- Add RTL handling if needed

## Lazy-Load Per-Route (When Splitting)

When splitting by feature, load only relevant namespaces per route to reduce initial payload.

## Professional Translation Review

Engage Arabic native speaker for:

- Tone and terminology consistency
- Plural rule correctness
- Cultural appropriateness
