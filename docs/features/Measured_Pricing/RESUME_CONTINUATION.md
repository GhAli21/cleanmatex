# Measured Pricing — resume here

1. Read [PLAN.md](PLAN.md) (design + owner decisions D1–D3) and [STATUS.md](STATUS.md) (authoritative progress).
2. Core rules: units come from the global `sys_uom_cd` catalog via `base_uom_code` (never free-text `product_unit`).
   A product is "measured" when its UoM dimension is not COUNT. `org_order_items_dtl.quantity` stays the integer
   piece/bag count; money multiplies the new `billed_qty`. UoM Layer 2 (packaging conversions) is designed, not built.
3. Load skills before writing: `/database` + `/multitenancy` (P1), `/order-fin` (P2–P6), `/frontend` + `/i18n` (P4–P6).
4. Migration number = live last+1 at write time; stop after writing it for owner apply.
5. Next step: see STATUS.md "Next".
