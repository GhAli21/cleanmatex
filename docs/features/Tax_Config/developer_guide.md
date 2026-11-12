# Tax Engine — Developer Guide

Read [ADR-061](ADR/ADR-061-Tax-Engine.md) first. Phase detail and checks: [STATUS.md](STATUS.md).

## 1. Model

```text
HQ (cleanmatexsaas)                          Organization (cleanmatex)
sys_tax_kits_mst                             org_tax_config_cf      status PENDING|ACTIVE, mode BASIC|ADVANCED,
  └ sys_tax_kit_versions_mst  ──apply──▶                            tax_enabled, kit + version used
      codes / item classes / rules /         org_tax_profiles_cf   tax codes, one row per version
      rule codes / worked examples           org_tax_item_classes_cf
sys_starter_pkg_mst (+ _trig_dtl)            org_tax_rules_cf + org_tax_rule_codes_dtl
sys_tax_return_box_cd (+ _map_dtl)           org_tax_lines_tr      the tax record
sys_tax_party_class_cd, sys_tax_segment_cd   org_tax_periods_mst   filing periods
```

- **Rule choice** (`lib/tax/determine.ts`): rules for the document's `tax_flow_code` and document type; a rule matches when all its set conditions match (item class, party class, country…); the most specific match wins, then priority; a tie is an error (`TAX_RULE_AMBIGUOUS`), no match is `NO_TAX_RULE`. Rules are checked for ties when saved. The code version is the one effective on the tax date.
- **No silent zero:** a missing rule or code version refuses the document with a message (EN/AR); it never charges 0.
- **Confirmation:** until `org_tax_config_cf.status = 'ACTIVE'` and `tax_enabled`, sales carry no tax and no tax lines (ADR-061). `fn_tax_config_confirm` checks readiness (registration numbers etc.).
- **Kit apply** `fn_tax_kit_apply(tenant, pkg, activate, …)` copies a published version into the `org_tax_*` tables, idempotent; rows the organization changed (`fn_tax_mark_modified`) are not overwritten and are reported as conflicts in `last_apply_summary`. Update mode (`fn_tax_kit_update`, GUC `app.tax_kit_update`) keeps status and `tax_enabled`.
- **Kit versions:** `fn_tax_kit_version_clone` (draft from published), `_check` (runs worked examples in SQL — mirror of `determine.ts`; keep them in step), `_publish` (all examples pass, effective date ≥ today), `_discard`. Trigger `fn_tax_kit_lock_guard` refuses changes to PUBLISHED/RETIRED rows unless `SET LOCAL app.tax_kit_seed = 'on'` (migrations only).

## 2. Tax record

`lib/services/tax/tax-lines.writer.ts` writes `org_tax_lines_tr` inside the document's transaction.

| Moment | Rows |
|---|---|
| Order create / Edit | PROVISIONAL, one per line (or piece) and code; header-only rows carry charges and the order-discount tax effect so rows = header tax |
| Invoice issued | rows become FINAL; `tax_date` in the branch time zone; `period_id` from `periodIdFor` |
| Edit after FINAL, refund credit note | reversal rows (`reverses_tax_line_id`) + new FINAL rows; FINAL rows are never updated |
| Purchases (T5) | INPUT rows with `recoverable_pct` |
| Advances, gift cards (T6) | `lib/services/tax/prepaid-tax.service.ts`: FINAL OUTPUT on receipt/sale, netted when used (pool per voucher) |

DB guard `fn_otl_guard` refuses FINAL rows in a CLOSED period and any change to FINAL rows.

Order money panel: `lib/services/order-fin-view/sources/items.source.ts` sums the order's rows per line and code (reversals are negative) → `taxParts` on item lines, shown under each line; the public projection drops them.

## 3. Return and posting

- `lib/tax/tax-return.ts` — pure: boxes LINES (filters: flow, category, reverse charge, emirate; measure TAX or RECOVERABLE), TOTAL (signed sum of boxes, cycle check), MANUAL. `lib/services/tax/tax-return.service.ts` loads FINAL lines in base currency grouped by tax date; every joined `org_*` table filtered by tenant.
- ERP-Lite: `TAX_ADVANCE_RECORDED/NETTED`, `TAX_GIFT_CARD_RECORDED/NETTED` (NON_BLOCKING) via `dispatchTaxReclassInTransaction`; `EXPENSE_RECORDED_V1` debits `VAT_INPUT` with the recoverable tax. Supplier payment `wht_amount`: cash paid = amount − withheld (AP is not posted to the GL by ERP-Lite).

## 4. Setup Health checks (0726)

`TAX_SETUP_NOT_CONFIRMED` (blocker, banner), `TAX_REG_NO_MISSING`, `TAX_DOC_TYPE_NO_RULE`, `TAX_PRODUCTS_NO_CLASS`, `TAX_EXEMPTION_EXPIRED`, `TAX_KIT_UPDATE_PENDING`, `TAX_KIT_FACT_UNVERIFIED` (HQ only). Functions `fn_shc_tax_*`, contract in [Setup Health developer guide](../Setup_Health/developer_guide.md).

## 5. Files

| Where | What |
|---|---|
| `web-admin/lib/tax/` | `determine.ts`, `order-line-tax.ts`, `purchase-tax.ts`, `prepaid-pool.ts`, `tax-return.ts` (pure) |
| `web-admin/lib/services/tax/` | config, codes, classes, rules, explain, periods, return, purchase, prepaid, writer |
| `web-admin/lib/commercial/commercial-context.loader.ts` | loads the rules for quote / create / booking / Edit |
| `web-admin/src/features/tax/` | Tax Setup screen (overview, codes, rules, classes, periods, exemptions), review screen, VAT return screen |
| `web-admin/lib/constants/tax.ts`, `lib/constants/permissions/tax-perm.ts`, `lib/validations/tax-schemas.ts` | constants, permissions, Zod |
| HQ `platform-api/src/modules/tax-setup/` | kits, versions, drafts, packages, apply / update per organization (audited) |
| HQ `platform-web/src/features/tax-setup/` | Tax Kits list + version drawer + draft dialogs, Starter packages, organization Tax kit page |

## 6. APIs (tenant)

| Route | Permission |
|---|---|
| `GET/PATCH /api/v1/tax/config`, `POST /tax/config/confirm` | view / `tax:manage_config` |
| `GET/POST /api/v1/tax/codes`, `PATCH /tax/codes/[id]` | view / manage |
| `GET/POST /api/v1/tax/rules`, `PATCH /tax/rules/[id]` | view / manage |
| `GET/POST /api/v1/tax/item-classes`, `PATCH /tax/item-classes/[id]` | view / manage |
| `GET /api/v1/tax/kits`, `POST /tax/kits/apply` | view / manage |
| `GET /api/v1/tax/explain`, `GET /tax/options` | `tax:view_config` |
| `GET/POST /api/v1/tax/periods`, `PATCH /tax/periods/[id]` | view / `tax:manage_periods` |
| `GET /api/v1/tax/returns`, `GET /tax/returns/lines` | `tax:view_reports` |
| `GET /api/v1/products/tax-classes` | `products:read` |

HQ: `/tax-setup/*` (`kits`, `kit-versions/:id` + `verify|unverify|draft|check|diff|publish`, `PATCH kit-versions/:id[/codes/:taxCode|/examples/:vectorCode]`, `DELETE kit-versions/:id`, `packages[/:pkgCode][/triggers]`, `tenants/:tenantId[/apply|/update-kit]`), `tax_packs.view` / `tax_packs.manage`.

## 7. Tests

`web-admin/__tests__/lib/tax/*` (determine, order-line tax, purchase tax, prepaid, return), `__tests__/services/tax/tax-lines.writer.test.ts`, HQ `platform-api/src/modules/tax-setup/__tests__/` (17). Rule: every published kit's worked examples pass (`fn_tax_kit_version_check`).

## 8. Adding a country kit

1. Collect facts with sources in [KIT_FACTS.md](KIT_FACTS.md).
2. New migration: kit + version 1 (DRAFT or seed with `app.tax_kit_seed`), codes, classes, rules, worked examples, return boxes; `is_verified = false` until a person checks the facts.
3. Starter package for the country (`is_country_default`).
4. HQ › Tax Kits: check examples, verify, publish.

## 9. Known limits

See [followups_by_user.md](followups_by_user.md): drafts do not edit rules / item classes; fixed-amount / document-level codes refused (`TAX_CODE_UNSUPPORTED`); foreign-currency purchases not taxed; no reverse-charge purchase rules seeded.
