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

## P4 — Units page and product form

The menu entry "Units & Conversions" under Catalog & Pricing comes from migration 0815 (already applied). Sign in as a tenant admin.

| # | Page | What to do | Expected |
|---|---|---|---|
| 1 | Catalog & Pricing → Units & Conversions (`/dashboard/catalog/units`) | Open it | Units tab lists the seeded units (PC, KG, M, SQM, L, HR …) with Active and System badges; product counts shown |
| 2 | Units → Add from system catalog | Tick one unit, add | Toast "Units added"; the unit appears in the list |
| 3 | Units → New custom unit | Code `BUNDLE`, dimension Count | Decimals locked to 0 with a note; save succeeds; try code `KG` → "belongs to a system unit" |
| 4 | Units → edit a system unit | Change the Arabic name, save | Badge becomes Customized; reset icon appears; reset returns the system value |
| 5 | Units → switch off a unit used by products | Toggle | Refused with "used by products"; base units cannot be switched off (toggle disabled) |
| 6 | Conversions tab → New conversion | From KG to LB, multiply 2.20462 | Divide fills in as 1 ÷ multiply (you can overtype it); save; a non-reciprocal pair is refused |
| 7 | Arabic locale | Switch to Arabic | Page mirrors (RTL), names and symbols use the Arabic text, numbers stay left-to-right |
| 8 | User without `uom:manage` | Open the page | Read-only: no add/edit/toggle buttons |
| 9 | Catalog → Services → edit a product | Open the Unit field | Picker lists your units; choosing KG reveals Minimum billable and Billing step; choosing a count unit hides them |
| 10 | Same form | Save a KG product with min 3 and step 0.5 | Saved; reopening shows both values |

## P4 — New Order: measured product and Measure dialog

Needs a product with unit KG, price type per unit, price 5.000, minimum 3, step 0.5 (see the product form checks above), and the product grid on New Order.

| # | Page | What to do | Expected |
|---|---|---|---|
| 11 | New Order → click the KG product | Click the product card | The Measure dialog opens (not added yet); shows "Minimum billed: 3 kg" and "Billed in steps of 0.5 kg"; Add is disabled |
| 12 | Same dialog | Type 3.2 | "Billed: 3.5 kg" and "Rounded up to the billing step."; typing a 4th decimal is not possible |
| 13 | Same dialog | Type 1 | "Billed: 3 kg" and "Raised to the minimum for this item." |
| 14 | Same dialog | Add | Line appears with the kg note under the name ("measured 3.2 kg · billed 3.5 kg"); line total and order total come from the server quote (5.000 × 3.5 = 17.500 before tax) |
| 15 | Cart row | Click "Change measure", set 6, Save | Same line is re-measured (no second line); billed 6 kg; total updates |
| 16 | Area product (unit m²) | Open its dialog | Length and Width fields; Add stays disabled until both are filled; billed = length × width |
| 17 | Piece product | Click it | Added immediately as before (no dialog) |
| 18 | Pay and save the order | Complete payment | Order saves; the stored item has `uom_code='KG'`, `measured_qty=3.2`, `billed_qty=3.5`; an issued tax invoice item shows 3.5 and KG. (Showing the measure on the order detail and prints is P6.) |
| 19 | Arabic locale | Switch to Arabic | Dialog and note mirror (RTL), symbol uses the Arabic text, numbers stay left-to-right |
| 20 | Edit an existing order, click the KG product | Click it | Message that measured items cannot be added or re-measured while editing yet (P5) |

| 21 | Inventory > Add item | Open the Unit field | Lists your organization's units as `CODE - name (symbol)`; saving a KG item stores `base_uom_code='KG'` |
| 22 | Inventory > Edit an item | Open it | Unit shows the item's current unit (not 'piece'); changing and saving updates the stock table's Unit column |
| 23 | Inventory > Adjust stock on a piece item | Enter 1.5 | Error: this unit allows fewer decimal places; a KG item accepts 1.5 |
| 24 | Edit an item's unit to KG, save | Check the booking catalog / list | `product_unit` text shows KG too, no stale 'piece' |

## P5 - Order Edit: measured line

Before: HQ must publish an Edit policy rule for `CHANGE_ITEM_MEASURE` (target Item), otherwise the control stays closed ("not allowed").

| # | Page | Do | Expect |
|---|---|---|---|
| 25 | Edit an order that has a KG line (3.2 kg, billed 3.5) | Open the line's "Change measure", enter 4.1, Save | The line shows 4.5 kg (4.1 measured); Review lists one "Change item measure" with the old and new measure and the new total |
| 26 | Same | Enter 1 (below the minimum 3) | Billed 3 kg; total = 3 x unit price; message "Raised to the minimum" |
| 27 | Same | Enter the same measure again | Review says no change |
| 28 | Edit an order, click a measured product | Enter a measure, Add | New line with its unit; Review lists "Add an item" with the measure; saving stores uom + measure + billed qty |
| 29 | Edit an order that has only count lines | Try to measure one (no button is shown) | Count lines have no "Change measure" |
| 30 | Order history / audit of the edited order | Open it | The measure change is recorded (target: item) with before/after measure |


## P4 fix - free-garment check on measured lines (steps 31-34)

Page: New Order, and Order Edit of an order with a measured line (e.g. Delicate Cardigan, meter).
31. Add a measured product (2 pieces, 2.5 m). On the card press `+`. **Expected:** the Measure dialog opens ("Pieces changed from 2 to 3. Check the total measure."), the total 2.5 is filled in, nothing changed yet in the cart.
32. Press Cancel. **Expected:** the cart still shows 2 pieces and 2.5 m. Repeat with step 2 `+` / `-`, Add piece, remove piece in the pieces manager: same dialog each time, Cancel leaves the count.
33. Press `+` again, change the total to 3.75, Confirm. **Expected:** 3 pieces, 3.75 m, the line total follows the billed measure. Press `+` and Confirm without changing the total: 4 pieces, same total (allowed, explicit).
34. A normal count product: `+`/`-` change at once, no dialog. Remove a measured line with `-` at 1 piece: removed, no dialog. In Order Edit, with the HQ rule for `CHANGE_ITEM_MEASURE` missing: changing the total and Confirm shows "this order does not allow changing it"; keeping the total works.


## P6 - customer-facing line qualifier (steps 35-40)

Use an order with a measured line (e.g. a rug in m, 2.5) and, in Order Edit, a second line of the same product with the same measure; plus one count line with its own speed (Express on a Standard order).
35. Order detail, Items tab: the measured line shows "2.5 m" after the product name; the Express line shows "Express"; two identical lines show "(1)" and "(2)". A plain line shows nothing extra.
36. Ready screen and Print (receipt + details): same text under each product name, Arabic shows the Arabic unit symbol and speed name.
37. Money view (order detail, `public` preset in the tracking page): the line labels carry the qualifier; no extra field leaks (only measure, speed name, number).
38. Public tracking link and the customer app order detail API: items show the qualifier; a line removed by an Edit no longer appears on Ready detail or prints.
39. WhatsApp/email receipt text: "Rug · 2.5 m² x1 - 12.500 OMR".
40. Customer app booking: a measured product is not offered; a forged submit returns `booking_item_needs_measure`.


## P7 - HQ Units & Conversions and product setup (steps 41-47)

Apply 0848 first (HQ menu). Sign in to HQ as TECH_ADMIN or SUPER_ADMIN.
41. HQ menu > Units & Conversions (or open `/uom-config`). **Expected:** two cards; EN and Arabic (RTL).
42. Units: add `TOLA` (Weight, 3 decimals, UN/ECE `GRM`). **Expected:** saved; after a refresh an organization's Units page lists it. Add a Count unit with 1 decimal: refused on "Decimal places". A base unit has no Deactivate button.
43. Units: change the dimension of `KG`. **Expected:** refused on the field (organizations use it). Deactivate a unit an active template is priced in: refused, naming the item codes.
44. Conversions: add `OZ` to `KG` if missing, rate 0.028349523125. **Expected:** "Divide by" is filled by the server. Add KG to M: refused (different things). A rate with 13 decimals: refused.
45. Products & Items > Templates: a template shows "Unit" (all units) and price type Fixed / Per unit; "Needs weight / dimensions" are gone. Set a template to `KG` + Fixed: refused on price type. Set `KG` + Per unit: saved.
46. Create an organization (or run catalog seeding) after step 45. **Expected:** that product is seeded with unit KG, not PC.
47. Bulk templates: export, change `base_uom_code` of one new row, import. **Expected:** the new row has that unit; an old file with `requires_weight` columns still validates.
