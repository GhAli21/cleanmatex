# Pending to Production — 16 Nov 2026

**Question answered:** what still has to be done before CleanMateX can be sold to real, paying laundries?
**Scope:** both repos: the tenant app (`cleanmatex`: web-admin, cmx-api, mobile apps, all migrations) and HQ, the SaaS Backoffice (`cleanmatexsaas`: platform-api, platform-web, platform-workers, marketing-web).
**Method:** each feature's own STATUS, RESUME, follow-ups and remaining-work files were read and spot-checked against the code on 16 Nov 2026. Then the remote database was checked read-only through the remote DB MCP: data, `pg_cron` and the Supabase security advisor.

## Verdict

The product itself (orders, workflow, payments, cash drawer, tax, notifications, ERP-Lite) is far along. Most features say "code complete, owner QA pending". **Two problems found in the live database come first:**

- **A. Database permissions are open (file 02, S0a–S0c).** The public `anon` key, which every browser has, can write to 178 tables that have row security off, including plan prices, discount codes, feature flags and tenant settings. It can also execute 98 privileged (SECURITY DEFINER) functions, such as `create_and_link_auth_user` and `cmx_rebuild_user_permissions`. Close this with one revoke migration before anything else.
- **B. Most background jobs are not scheduled (file 03, I11a).** 13 of 18 enabled jobs have no `pg_cron` entry, including the notification sender (55 messages waiting), POS day rollover, expiries and session sweep.

**Then the gaps around the product:**

1. **CleanMateX cannot collect money from its own customers yet.** Sign-up gives a 14-day free trial, and nothing ever ends it (the expiry job is never scheduled). HQ billing has no card or gateway charging.
2. **There are no legal pages** (Terms of Service, Privacy Policy, Data Processing terms) on the marketing site or in the app.
3. **Real customers cannot pay laundries online.** The payment-gateway layer has only a generic placeholder; no Stripe, HyperPay, PayTabs, Thawani or Tap integration exists.
4. **Saudi e-invoicing (ZATCA Phase 2) is not built.** Only the document layout exists, with no clearance, signing or ZATCA QR code. Do not market to Saudi VAT-registered laundries until this is done.
5. **Manual QA is the biggest backlog.** About 15 programs were checked only by automated tests and have never been opened in a browser.
6. **Two security switches are still in "report only" mode:** the tenant-isolation guard (`TENANT_GUARD_MODE` defaults to `log`), and HQ sign-in policy grants needed before more HQ staff are added.

**Recommendation:** run a **closed pilot** first, with 1–3 friendly laundries in Oman, UAE or Bahrain, invoiced manually and paying in cash or by bank transfer at their counter. Do the Blocker rows in each file before that, and the "Before public launch" rows before marketing opens publicly.

## Files

| # | File | Area |
|---|---|---|
| 01 | [01_business_and_commercial_blockers.md](01_business_and_commercial_blockers.md) | Billing your customers, trial, legal, support, pricing |
| 02 | [02_security_and_tenant_isolation.md](02_security_and_tenant_isolation.md) | Tenant guard, DB integrity, sessions, HQ RBAC |
| 03 | [03_infrastructure_deploy_and_operations.md](03_infrastructure_deploy_and_operations.md) | Deploy, CI, monitoring, backups, email, environments |
| 04 | [04_orders_workflow_and_order_edit.md](04_orders_workflow_and_order_edit.md) | Orders, workflow engine, Order Edit V2, delivery |
| 05 | [05_order_finance_payments_and_pos.md](05_order_finance_payments_and_pos.md) | Payments, gateways, POS and cash drawer, fin view |
| 06 | [06_tax_and_e_invoicing.md](06_tax_and_e_invoicing.md) | Tax engine, kits, ZATCA, VAT returns |
| 07 | [07_notifications.md](07_notifications.md) | Notification Hub, providers, ops console |
| 08 | [08_catalog_pricing_speeds_setup_health.md](08_catalog_pricing_speeds_setup_health.md) | Catalog, pricing, Service Speeds, holidays, Setup Health |
| 09 | [09_customers_users_and_identity.md](09_customers_users_and_identity.md) | Customer identity, staff users, B2B |
| 10 | [10_hq_backoffice.md](10_hq_backoffice.md) | HQ screens and modules |
| 11 | [11_mobile_apps.md](11_mobile_apps.md) | Customer, staff and driver apps |
| 12 | [12_manual_qa_backlog.md](12_manual_qa_backlog.md) | All browser QA still owed, in one list |
| 13 | [13_data_cleanup_before_go_live.md](13_data_cleanup_before_go_live.md) | Demo data and test leftovers to remove |

## Priority labels used in every file

| Label | Meaning |
|---|---|
| **Blocker** | Must be done before the first paying laundry (pilot included). |
| **Before public launch** | Can wait during a supervised pilot; must be done before open marketing. |
| **After launch** | Real gap, but it can follow launch. |
| **Later** | Nice to have, or a deliberate later phase. |

## Repo state on 16 Nov 2026

- Tenant repo `cleanmatex`: working tree clean (everything committed).
- HQ repo `cleanmatexsaas`: 3 uncommitted files.
- Latest migration file: `0752`. Per the feature docs, nothing is waiting to be applied (not re-checked against the remote DB today).
