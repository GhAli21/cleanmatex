# Changelog: Measured Pricing and Units of Measure

## 2026-11-28

- **Fixed (pricing):** a square-foot or custom area product was measured in metres and charged as its unit. Any
  area unit now prices correctly: staff type the area, or length × width in any length unit and the area is worked
  out in the product's unit (0860). Added square millimetre, centimetre, inch, yard, are, hectare and acre to the
  system catalog.
- Edit review shows the measure of a newly added line.
- Receipts, prints, order page, tracking, money view, cart and customer app show the billed quantity, why it differs
  (minimum or billing step) and the unit price. Tax documents print the invoiced unit.
- Product form: price per unit, a "what will be charged" example, checked minimum and step; product cards show "/ kg".
- Units screen: search, filters, product counts (they always showed 0), packaging flag, UN/ECE code and display order.
- Searchable unit picker (`CmxCombobox`, `CmxUomSelect`).
- Conversions: per-product "Units and packs", delete, live result, active switch; rates keep every digit.
- Measure window: on-screen keypad and entry in other units.
- Fixed (customer app credentials): creating the global customer record omitted `customer_code`.

## 2026-11-27

- HQ: Units & Conversions API and screens, product setup on `base_uom_code`, maintenance "Sync units", Setup Health
  check for measured products without a price (0848, 0849).
- Guards: an active template cannot use a switched-off unit; the HQ edit form can no longer switch off a unit in use
  (0850).
- Customer app: order detail shows the measure, the billed quantity and the amount the customer pays.
- Legacy unit columns removed; catalog seeding copies `base_uom_code` (0852, 0853). Bulk files that name the unit only
  in `product_unit` are refused.
- Fixed: a custom weight, length, area, volume or time unit could not be created (the screen did not ask for its size).
- Fixed: the product CSV export wrote units that its own import refused.

## 2026-11-25

- Measure shown on the money view, tracking, receipts, prints and order detail; measured products hidden from booking.

## 2026-11-24

- Units platform and numeric precision classes (0813–0815, 0817), measured pricing in the calculator, order creation
  and APIs, tenant Units screen, cart measure dialog, Order Edit measure change (0821).
