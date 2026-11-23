# Measured Pricing — resume here

1. Read [PLAN.md](PLAN.md) (design + owner decisions D1–D3) and [STATUS.md](STATUS.md) (authoritative progress).
2. Core rule: `org_order_items_dtl.quantity` stays the integer piece/bag count. Money multiplies the new `billed_qty`
   for `PER_KG` / `PER_M` / `PER_SQM` lines. The unit comes from `price_type`, never from `product_unit`.
3. Load skills before writing: `/database` + `/multitenancy` (P1), `/order-fin` (P2–P6), `/frontend` + `/i18n` (P4–P6).
4. Migration number = live last+1 at write time; stop after writing it for owner apply.
5. Next step: see STATUS.md "Next".
