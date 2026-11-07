# ADR-061: Rule-Based Tax Engine with HQ Country Kits

**Status:** Accepted (owner-approved 2026-11-07) · **Date:** 2026-11-07
**Plan:** [TAX_ENGINE_PLAN.md](../TAX_ENGINE_PLAN.md) · **Builds on:** [ADR-060](../../Order_Fin/ADR/ADR-060-Line-Level-Commercial-Calculation.md) · **Related:** [ADR-062](ADR-062-Document-Identity.md)

## Context

- Today a line's tax comes from `org_tax_profiles_cf.applies_to` / `is_default` and the product's `tax_supply_code`. With more than one active profile (2 demo tenants already) the system cannot say which one applies, and only the first profile is kept on the line.
- Purchases and payouts store a bare `tax_amount`; there is no input VAT, withholding or return report.
- Laundry owners have little tax knowledge: setup must come ready from HQ (HQ = the SaaS Backoffice).

## Decisions

1. **A rules table decides the tax.** `org_tax_rules_cf` matches on document type, tax flow, branch, place of supply, item tax class, party tax class and party country scope (NULL = any). The most specific rule wins, then priority. Two equally specific rules are refused when saved. No match while tax is enabled returns `NO_TAX_RULE`; the system never silently charges zero.
2. **Tax codes are versioned and immutable once used.** `org_tax_profiles_cf` becomes the tax-code table (`tax_code`, `version_no`, …). A rate change is a new version from its effective date.
3. **One pure calculator.** `web-admin/lib/tax/` has no I/O and handles inclusive/exclusive, stacked, compound, fixed levies, document-level tax, rounding and FX. `lib/commercial/tax.ts` delegates to it.
4. **Every tax result is recorded per line.** `org_tax_lines_tr` holds `PROVISIONAL` rows while the source can change, and `FINAL` rows at the tax point. FINAL rows cannot be updated or deleted; corrections are reversal rows on credit/debit notes. `org_order_taxes_dtl` is rebuilt from these rows.
5. **HQ prepares country kits.** HQ owns country packs and kits (codes, item classes, rules, test vectors). `fn_tax_kit_apply(tenant, pkg_code, actor)` copies a kit into an organization as a pending setup, and `fn_tax_config_confirm` activates it. HQ support may apply and activate with a reason, or the owner confirms in the tenant app. Until it is active, orders are not taxed and a banner says why (Setup Health).
6. **Starter packages are typed tables, not general settings.** `sys_starter_pkg_mst` (country × segment) points by FK to the kit and calendar template. The organization's choices are plain columns. No `sys_stng_*` values are added.
7. **Basic and Advanced modes.** Basic answers plain questions; Advanced shows codes, rules and classes. Basic is the default.
8. **Registration per branch.** A NULL branch value means the organization's.

## Consequences

- Sales keep today's engine until T4 lands complete; each phase can ship on its own.
- Kit rates and return boxes are legal facts: each verified kit cites its official source and review date; generic kits never claim to be verified.
- E-invoicing connectors (ZATCA, Oman, UAE) are a separate program; the tax lines give them the data they need.
- No maker≠checker: the permission is the approval gate.

## Alternatives rejected

- **Keep `applies_to` / `is_default` profiles:** cannot decide between several profiles or cover purchases.
- **Starter packages as settings profiles:** values have no types, FKs or CHECKs and need a profile-chain resolver (owner decision 2026-11-07).
- **Tax per order only:** cannot produce the per-line split needed by tax invoices, credit notes and piece-level money.
