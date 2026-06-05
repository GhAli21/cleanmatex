# Feature Flag: tax_inclusive_pricing

**Catalog key:** `tax_inclusive_pricing`  
**Constant:** `FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING`  
**Status:** Registered — awaiting settings UI + access-contract wiring  
**Governance:** `experimental` · `independent` (not plan-bound)  
**Default:** `false`

---

## What this flag gates (future sprint)

When the Settings UI for `TAX_PRICING_MODE` and `EXTRA_PRICE_PRICING_MODE` is built, its access contract will check `tax_inclusive_pricing`. Until those UI sections exist, this flag has no visible effect in the admin panel.

The calculator already supports both modes (`TAX_INCLUSIVE` / `TAX_EXCLUSIVE`) and is live. Calculator behavior is **not** gated by this flag — only the Settings UI section that lets tenants toggle the mode will be gated.

---

## How to enable

1. GrowthBook → cleanmatexsaas → Feature Flags → search `tax_inclusive_pricing`
2. Enable per tenant or globally
3. Set `TAX_PRICING_MODE = TAX_INCLUSIVE` directly on the branch DB row (until Settings UI is built):
   ```sql
   UPDATE org_stng_branch_settings_cf
   SET setting_value = '"TAX_INCLUSIVE"'
   WHERE branch_id = '<branch-id>'
     AND setting_code = 'TAX_PRICING_MODE';
   ```

---

## Rollback

Disable flag in GrowthBook → Settings UI hidden → `pricing-mode-resolver.service.ts` falls back to `TAX_EXCLUSIVE` default.

---

## Future wiring (when Settings UI is built)

1. Add `featureFlags: ['tax_inclusive_pricing']` to the access contract for the Settings section that shows `TAX_PRICING_MODE` / `EXTRA_PRICE_PRICING_MODE` in `web-admin/lib/auth/access-contracts.ts`
2. Wire `pricing-mode-resolver.service.ts` to check the flag before reading the DB setting
3. Expose the DB setting in the Settings UI (screen under `dashboard/settings/finance`)

---

## Related

- Calculator: `lib/services/pricing-mode-resolver.service.ts`
- DB settings seeded: migration `0339_tax_pricing_mode_config.sql`
- ADR: `docs/features/Order_Fin/ADR/ADR-017-Tax-Inclusive-and-Tax-Exclusive-Pricing.md` (Implemented, Phase 5)
- Soak checklist: [FF_TAX_INCLUSIVE_PRICING-soak-checklist.md](./FF_TAX_INCLUSIVE_PRICING-soak-checklist.md)
