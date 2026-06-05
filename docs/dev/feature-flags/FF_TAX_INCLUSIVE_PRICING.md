# Feature Flag: tax_inclusive_pricing

**Catalog key:** `tax_inclusive_pricing`  
**Constant:** `FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING`  
**Status:** Wired — settings UI live; `TAX_INCLUSIVE` option gated by this flag  
**Governance:** `experimental` · `independent` (not plan-bound)  
**Default:** `false`

---

## What this flag gates

The `TAX_INCLUSIVE` option in the **Tax Pricing Mode** dropdown is only rendered when this flag is `true`:
- `src/features/settings/ui/tenant-settings-screen.tsx` — Tenant Settings page
- `src/features/settings/ui/branch-settings-screen.tsx` — Branch Settings page

Both screens use `useFeature(FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING)` from `RequireFeature.tsx`.

If a branch/tenant already has `tax_pricing_mode = 'TAX_INCLUSIVE'` saved and the flag is subsequently disabled, the option remains visible for that row (to avoid orphaning the active value), but cannot be re-selected after changing away.

The calculator already supports both modes (`TAX_INCLUSIVE` / `TAX_EXCLUSIVE`) and is live. Calculator behavior is **not** gated by this flag.

---

## How to enable

1. GrowthBook → cleanmatexsaas → Feature Flags → search `tax_inclusive_pricing`
2. Enable per tenant or globally
3. The `TAX_INCLUSIVE` option will appear in the Tax Pricing Mode dropdown on both the Tenant Settings page (`/dashboard/settings/tenant`) and Branch Settings page (`/dashboard/settings/branches`)

---

## Rollback

Disable flag in GrowthBook → Settings UI hidden → `pricing-mode-resolver.service.ts` falls back to `TAX_EXCLUSIVE` default.

---

## Wiring complete

All three layers are now gated:

| Layer | File | Gate |
|---|---|---|
| Settings UI — Tenant | `src/features/settings/ui/tenant-settings-screen.tsx` | `useFeature(FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING)` hides the TAX_INCLUSIVE option |
| Settings UI — Branch | `src/features/settings/ui/branch-settings-screen.tsx` | same |
| Calculator (server) | `lib/services/pricing-mode-resolver.service.ts` | `getFeatureFlags(tenantId)` check before returning TAX_INCLUSIVE; falls back to TAX_EXCLUSIVE when flag is off |

---

## Related

- Calculator: `lib/services/pricing-mode-resolver.service.ts`
- DB settings seeded: migration `0339_tax_pricing_mode_config.sql`
- ADR: `docs/features/Order_Fin/ADR/ADR-017-Tax-Inclusive-and-Tax-Exclusive-Pricing.md` (Implemented, Phase 5)
- Soak checklist: [FF_TAX_INCLUSIVE_PRICING-soak-checklist.md](./FF_TAX_INCLUSIVE_PRICING-soak-checklist.md)
