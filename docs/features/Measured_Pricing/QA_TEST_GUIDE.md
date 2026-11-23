# Measured Pricing / UoM — QA test guide

Owner checks per phase. Progress lives in [STATUS.md](STATUS.md).

## P1 — after applying 0813, 0814, 0815 (in this order)

Run each query in the Supabase SQL editor. Expected result is under each one.

1. **System catalog seeded**
   ```sql
   select count(*) filter (where is_to_seed) seeded, count(*) total from sys_uom_cd;
   select count(*) from sys_uom_conv_cd;
   ```
   Expected: `seeded 22, total 27`; `12` conversions.

2. **Every Organization has its units and base units**
   ```sql
   select t.id, count(u.*) units, count(*) filter (where u.is_base_unit) bases
     from org_tenants_mst t left join org_uom_cf u on u.tenant_org_id = t.id
    group by t.id order by units;
   ```
   Expected: every row has `units` ≥ 22 and `bases = 6`.

3. **System conversions copied**
   ```sql
   select tenant_org_id, count(*) from org_uom_conv_cf where is_from_system group by 1;
   ```
   Expected: every Organization has 8 (pairs whose both units are seeded).

4. **Products moved to units**
   ```sql
   select base_uom_code, price_type, count(*) from org_product_data_mst group by 1, 2 order by 3 desc;
   ```
   Expected: only `PC`, `SUIT`, `PAIR`, `SET`; price types only `PER_UNIT` / `FIXED`; no NULLs.

5. **Order lines have a unit snapshot**
   ```sql
   select uom_code, uom_dimension, price_type, count(*) from org_order_items_dtl group by 1, 2, 3;
   ```
   Expected: 49 lines, all `COUNT`, no NULLs; `measured_qty` / `billed_qty` all NULL.

6. **Permissions and menu**
   ```sql
   select permission_code, string_agg(role_code, ',' order by role_code)
     from sys_auth_role_default_permissions where permission_code like 'uom:%' group by 1;
   select comp_code, comp_path, main_permission_code from sys_components_cd where comp_code = 'catalog_units';
   ```
   Expected: `uom:view` for the same roles as `products:read`, `uom:manage` for the same roles as `products:update`;
   one menu row `/dashboard/catalog/units`. (The menu page itself arrives in P4.)

7. **Rules hold** (each statement must fail with the given message; run inside `begin; … rollback;`)
   ```sql
   begin;
   -- a) custom unit cannot reuse a system code → UOM_CODE_RESERVED
   insert into org_uom_cf (tenant_org_id, uom_code, name, symbol, uom_dimension)
   select id, 'KG', 'x', 'x', 'MASS' from org_tenants_mst limit 1;
   rollback;

   begin;
   -- b) a piece quantity with decimals → UOM_QTY_SCALE
   select fn_uom_assert_qty_scale((select id from org_tenants_mst limit 1), 'PC', 1.5);
   rollback;

   begin;
   -- c) conversion: 2 lb in kg (expected 0.90718474), 30 pc in box without a product pair → UOM_CONVERSION_MISSING
   select fn_uom_convert((select id from org_tenants_mst limit 1), null, 2, 'LB', 'KG');
   select fn_uom_convert((select id from org_tenants_mst limit 1), null, 30, 'PC', 'BOX');
   rollback;
   ```

8. **App still works before P2/P3** (the bridge triggers): in web-admin create a product (Catalog › Services),
   edit its price, create an order with it, pay. Expected: everything works as before; the new product row has
   `base_uom_code = 'PC'` and `price_type = 'PER_UNIT'`.

9. **New Organization gets units**: create a test Organization from HQ. Expected: query 2 shows it with ≥ 22 units.

Then run `/pull-prisma` (tenant) and regenerate HQ database types.

## P2/P3 — after migration 0817 (applied) and the server work

AMOUNT precision stays `(19,4)`; 0817 fixes `fn_uom_convert` so a COUNT target is judged at 6 decimals (24 PC to BOX is no longer rejected for float noise).

1. **Units API** (signed in as an admin with `uom:manage`): `GET /api/v1/uom/units` lists the Organization units; `POST` with `{"kind":"custom","code":"M2X","dimension":"AREA","name":"Test","symbol":"m2x","qtyDecimals":2}` creates one; `PATCH /api/v1/uom/units/M2X` renames it; a user with only `uom:view` gets 403 on the write routes.
2. **Conversions**: `POST /api/v1/uom/conversions` with `LB`→`KG`, `multiplyRate 0.453592909436`, `divideRate 2.20462` works; `divideRate 5` is refused (rates must be reciprocal). `POST /api/v1/uom/convert` `{"quantity":"2","fromCode":"LB","toCode":"KG"}` returns about `0.907185`.
3. **Measured product**: `POST /api/v1/products` with `base_uom_code":"KG"`, `price_type":"PER_UNIT"`, `min_billable_qty":"3"`, `billing_increment":"0.5"`. A `FIXED` price on KG is refused (`UOM_FIXED_PRICE_MEASURED`); a minimum on a piece product is refused (`MEASURE_NOT_ALLOWED`).
4. **Measured order** (quote or payment-quote with `measure:{"measuredQty":"3.2"}`, quantity 1): the quote bills `3.5` kg (minimum 3, step 0.5). Without `measure` the answer is 422 `MEASURE_REQUIRED`; `measuredQty` with 4 decimals on KG (3 allowed) is 422 `UOM_QTY_SCALE`; a measure on a piece product is 422 `MEASURE_NOT_ALLOWED`. After creating the order, `org_order_items_dtl` has `uom_code='KG'`, `measured_qty=3.2`, `billed_qty=3.5`, `price_type='PER_UNIT'`.
5. **Piece orders unchanged**: an order of piece products prices and prints exactly as before; its lines have `uom_code='PC'`, no measure.
6. **Invoice**: issue a tax document for the measured order; its item shows quantity `3.5` and `uom_code='KG'`, `uom_unece_code='KGM'`.
