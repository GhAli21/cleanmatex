# Phase C — FF_TAX_INCLUSIVE_PRICING Flag Registration + Soak Docs

**Date:** 2026-06-05  
**Migration:** none  
**Program:** Post-v1.1 Hardening

---

## Goal

Register `tax_inclusive_pricing` in the flag catalog and document the staging soak process. Access-contract wiring is explicitly deferred to the Settings UI build sprint.

---

## Background

- `pricing-mode-resolver.service.ts` exists and resolves `TAX_PRICING_MODE` from branch → tenant → defaults to `TAX_EXCLUSIVE`. It has no feature-flag check.
- The calculator supports both `TAX_INCLUSIVE` and `TAX_EXCLUSIVE` modes and is live.
- Settings DB rows (`TAX_PRICING_MODE`, `EXTRA_PRICE_PRICING_MODE`) were seeded in migration 0339.
- **Gap closed:** `FF_TAX_INCLUSIVE_PRICING` was not registered in the flag catalog.
- **Explicitly deferred:** Access-contract wiring for the Settings UI section — to be done when that UI is built.

---

## Files Modified

| File | Change |
|---|---|
| `lib/constants/feature-flags.ts` | Added `tax_inclusive_pricing` to `FLAG_CATALOG`; added `TAX_INCLUSIVE_PRICING` to `FEATURE_FLAG_KEYS` |
| `docs/dev/feature-flags/FF_TAX_INCLUSIVE_PRICING.md` | New — flag definition, how to enable, rollback, future wiring |
| `docs/dev/feature-flags/FF_TAX_INCLUSIVE_PRICING-soak-checklist.md` | New — staging soak checklist with sign-off gate |

---

## Flag Registration

```typescript
// FLAG_CATALOG entry
{
  flag_key: 'tax_inclusive_pricing',
  flag_name: 'Tax Inclusive Pricing',
  plan_binding_type: 'independent',
  data_type: 'boolean',
  default_value: false,
  ui_group: 'Finance',
  governance_category: 'experimental',
  ui_display_order: 0
}

// FEATURE_FLAG_KEYS entry
TAX_INCLUSIVE_PRICING: 'tax_inclusive_pricing',
```

---

## Deferred Work (future sprint)

When the Settings UI for `TAX_PRICING_MODE` / `EXTRA_PRICE_PRICING_MODE` is built:

1. Add `featureFlags: ['tax_inclusive_pricing']` to the access contract for that Settings section in `web-admin/lib/auth/access-contracts.ts`
2. Wire `pricing-mode-resolver.service.ts` to check the flag before reading the DB setting
3. Expose the DB setting in the Settings UI screen under `dashboard/settings/finance`

---

## Verification

- `npm run typecheck` — 0 errors ✓
- `npm run build` — green ✓
