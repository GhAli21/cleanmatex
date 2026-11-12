# Tax Engine — Changelog

## 1.0.3 — 2026-11-13

- `0733`: ERP-Lite purchase documents store a real FX rate (DECIMAL(22,10)) with its date, source and rate id; services to use it next.

- `0732` + HQ: draft kit versions can add and change rules (with their ordered tax codes) and item classes in HQ › Tax Kits; ties between rules are refused; the flow default class moves safely.

- Menu gates follow the page access contracts (`0729`); UAE VAT 201 return boxes verified against the FTA manual (`0730`).
- Purchase reverse charge (`0731`, kit version 2 of OM/SA/AE/BH): GCC suppliers reverse-charged; foreign reverse charge for every segment (v1 only ENTERPRISE); rule precedence fixed (a foreign purchase with an item class was refused as ambiguous); new code `VAT_IN_RC_NONREC`; kit check runs purchase examples (`flow`, `country_scope`).
- HQ: test debt cleared (platform-api tsc 0); tenant permission service and runtime guard bugs fixed.

## 1.0.2 — 2026-11-12

- Kit facts checked against official sources (`0728`): OM return layout replaced by the official 20 boxes; OM simplified invoice limit OMR 500 (with Tax Authority approval); SA return boxes and simplified-invoice rule verified; gift card tax timing per kit (OM, BH, AE at sale; SA when used) used as the default when a card is sold; HQ kit drafts can change it. BH return lines 1–16 still to confirm.

## 1.0.1 — 2026-11-12

- **T4 leftovers done.** Order money panel shows each item's tax by code (from `org_tax_lines_tr`, staff views only).
- **M4b** Old tax engine removed: `tax-engine.service.ts`, the old tax profile editor, its server actions and `/api/v1/settings/tax/profiles`. The calculator no longer reads supply codes. Migration 0727 drops `applies_to`, `is_default` (tax codes) and `tax_supply_code` (products).
- Exemption changes now need `tax:manage_config` (they had no permission check).
- Service Speeds: a retail item in an Express order keeps its price instead of refusing the order.

## 1.0.0 — 2026-11-12

- **T1** Document identity: `doc_type_code` on every transaction header from `sys_doc_seq_type_cd` (`tax_flow_code`, `is_tax_relevant`) — ADR-062. Migration 0708.
- **T2** HQ tax kits (OM, SA, AE, BH VAT, NO_VAT, GENERIC_VAT) with versions, codes, item classes, rules, worked examples; starter packages per country and segment; HQ Tax Kits and Starter Packages screens. Migrations 0712, 0713.
- **T3** Organization tax setup: kit apply, review and confirm, Basic / Advanced mode, tax codes (versioned), tax rules (tie check, "Why this tax?"), item tax classes, registration numbers per branch; HQ Apply tax kit. Migration 0718.
- **T4** Sales taxed by rules (quote, create, booking, Edit share one path); no tax before confirmation; tax record `org_tax_lines_tr` (provisional → final at invoice, reversals for corrections); old profiles converted. Migrations 0719, 0722.
- **T5** Purchases taxed by rules (expenses, purchase orders, supplier invoices), recoverable share, supplier tax class. Migration 0723.
- **T6** Advances taxed when received; gift cards single- or multi-purpose.
- **T7** Tax periods (close / reopen), VAT return per kit box layout with drill-down and CSV, ERP-Lite tax reclass events and Input VAT on expenses, withholding tax on supplier payments. Migration 0725.
- **T8** 7 TAX checks in Setup Health (banner when not confirmed); published kits locked; HQ kit drafts (edit, check, compare, publish, discard); nightly kit update and "Update kit now"; new organizations get the country package. Migration 0726.
- **T9** Docs pack, glossary terms, integration contracts (both repos), inventories.
- Known limits: see [followups_by_user.md](followups_by_user.md).
