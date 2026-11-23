# Measured Pricing — resume here

1. Read [PLAN.md](PLAN.md) (design + owner decisions D1–D14) and [STATUS.md](STATUS.md) (authoritative progress).
2. Core rules: units come from `org_uom_cf` (seeded from `sys_uom_cd`) via `base_uom_code` (never free-text `product_unit`).
   A product is "measured" when its UoM dimension is not COUNT. `org_order_items_dtl.quantity` stays the integer
   piece/bag count; money multiplies the new `billed_qty`. Conversions are open (multiply + divide rate stored, like FX),
   resolved by a bounded two-leg resolver (PLAN §3.4). Numeric columns follow the precision classes in PLAN §3.1.
   Tenant units live in `org_uom_cf`: seeded copies of system units (`is_to_seed`, synced from HQ by trigger, locked fields
   protected) plus custom units; all tenant tables FK to it (PLAN §3.3). COUNT quantities are whole (D11). Minimum and
   `billing_increment` are optional tenant product fields (§3.6a). Work spans cleanmatex, cleanmatexsaas, cmx_mobile_apps.
3. Load skills before writing: `/database` + `/multitenancy` (P1), `/order-fin` (P2–P6), `/frontend` + `/i18n` (P4–P6).
4. Migration number = live last+1 at write time; stop after writing it for owner apply.
5. Next step: see STATUS.md "Next".
