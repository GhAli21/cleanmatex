# Measured Pricing on a Units of Measure platform

Price a product by weight, length, area or any other unit that is not a count (for example a rug per m² or
laundry per kg), on a unit catalog shared by sales and inventory. Covers the tenant app, HQ and the customer app.

| Read | For |
|---|---|
| [user_guide.md](user_guide.md) | Organization staff (English and Arabic) |
| [developer_guide.md](developer_guide.md) | How units, conversions, pricing and display work |
| [STATUS.md](STATUS.md) | Progress and gates per phase |
| [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) | Manual test steps |
| [PLAN.md](PLAN.md) | Design and owner decisions |
| [RESUME_CONTINUATION.md](RESUME_CONTINUATION.md) | Handoff notes |
| [CHANGELOG.md](CHANGELOG.md) | What changed |
| HQ: `cleanmatexsaas/docs/features/UoM_Config/README.md` | HQ unit catalog screens |

## Implementation facts

| Item | Value |
|---|---|
| Tenant permissions | `uom:view`, `uom:manage` (0815). Product fields use the existing product permissions |
| HQ permissions | `uom_config:view`, `uom_config:manage` (0815) |
| Tenant navigation | Catalog > Units & Conversions, `/dashboard/catalog/units` (`uom:view`) |
| HQ navigation | `/uom-config`, `/uom-config/units`, `/uom-config/conversions` (0848) |
| Tenant APIs | `/api/v1/uom/units`, `/units/[code]`, `/units/[code]/reset`, `/catalog`, `/conversions` (`?product_id=`), `/conversions/[id]` (PATCH, DELETE), `/conversions/[id]/reset`, `/convert`; `/units?with_counts=true` |
| HQ APIs | `uom-config/*`; organization maintenance `check-units`, `fix-units-sync` |
| Tables | `sys_uom_cd`, `sys_uom_conv_cd`, `org_uom_cf`, `org_uom_conv_cf`; unit and measure columns on products and order lines |
| Order Edit | change code `CHANGE_ITEM_MEASURE` (ITEM level); needs an HQ Edit policy rule |
| Setup Health | `MEASURED_PRODUCT_NO_PRICE` (0849) |
| Translations | tenant `messages/{en,ar}/uom.json`; HQ `uomConfig.json`; customer app `orders.line.billed`, `billedMinimum`, `billedStep` |
| Feature flags, settings, plan limits, environment variables | none |

## Migrations

| File | Content |
|---|---|
| 0813 | Unit and conversion tables, seeds, sync, resolver, guards |
| 0814 | Product and order-line unit columns, backfill, numeric precision |
| 0815 | Permissions and tenant menu |
| 0817 | Whole-count check judged at 6 decimals |
| 0821 | `CHANGE_ITEM_MEASURE` in the Edit catalogs |
| 0848 | HQ menu |
| 0849 | Setup Health check for measured products without a price |
| 0850 | Active templates cannot use a switched-off unit |
| 0852 | Catalog seeding copies `base_uom_code`; column defaults |
| 0853 | Legacy `product_unit` and `requires_*` columns removed |
| 0860 | Any area unit: area typed or worked out from a size in metres; SQMM, SQCM, SQIN, SQYD, ARE, HA, ACRE in the catalog |

## Limits

- Square kilometre and square mile are not in the catalog: at 6 decimals a small item would round to double.
- Measured products are not offered in the customer app booking (owner decision 2026-11-27).
- Prices are stated per the product's base unit only.
- A measure is a line fact (total of all pieces), like the line price.
- A measure typed in another unit (pounds, feet, a product pack) is converted before saving; the order stores and
  prints the product's unit only.
- Units are not cached on the server: reads take about 2 ms on an index (measured 2026-11-28) and HQ changes them
  directly in the database. Browsers keep them for five minutes.
