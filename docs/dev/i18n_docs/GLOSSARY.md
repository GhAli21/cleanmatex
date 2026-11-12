# Platform Glossary — EN/AR

Canonical terminology for the whole platform (both `cleanmatex` and `cleanmatexsaas`), not just
`web-admin`. One concept = one key = one approved term per language. Purpose: stop the same concept
being translated two different ways in different corners of the app (what already started happening
with "Tenant", translated as "مستأجر" in 35 files before this glossary existed).

## Files

- [glossary.en.json](./glossary.en.json) — `{ key: "Approved English term" }`
- [glossary.ar.json](./glossary.ar.json) — `{ key: "Approved Arabic term" }`

Both files share the exact same key set, always. A key present in one and missing in the other is a
bug — check both files whenever you add or rename a term.

## Using this glossary when writing locale keys

Check this glossary **before adding a new `messages/**` key and before editing the text of an existing
one** — not just at creation time. If the concept already has an approved term here, that term is what
the key's EN/AR value must say; an edit must not quietly drift away from it. And before adding any new
key at all, search for one that already covers the same concept and reuse it — avoid duplicate keys as
much as possible, even across different namespaces.

## Rules

1. **One key per concept, never per literal word.** The key is a stable, language-neutral identifier
   (snake_case, singular, e.g. `tenant`) — not a copy of the English term. If two different concepts
   would otherwise share an obvious word (e.g. an order's "status" vs. a drawer session's "status"),
   give them two distinct keys instead of reusing one.
2. **No duplicate keys.** Before adding a term, check both JSON files for an existing key covering the
   same concept. Reuse it; don't add a near-duplicate.
3. **The glossary term is what user-facing UI text must say** in `web-admin/messages/**` and
   `platform-web` (cleanmatexsaas), in both EN and AR. It does **not** rename code: DB table/column
   names, Prisma models, TypeScript identifiers (`tenant_org_id`, `TenantContext`,
   `getTenantIdFromSession`, etc.) stay exactly as they are — those are internal/infrastructure
   vocabulary, not display copy, and renaming them is a separate, much riskier refactor this glossary
   does not ask for.
4. Adding or changing a term here is a terminology decision, not a routine edit — note the *why* in
   the table below so it isn't re-litigated per file later.
5. After adding/changing a term, `npm run check:i18n` still governs the actual `messages/**` files;
   this glossary is the term-choice reference those files must follow, not a replacement for them.

## Terms

| Key | English | Arabic | Notes |
|---|---|---|---|
| `tenant` | Organization | المنشأة | Replaces "Tenant" (EN) / "مستأجر" (AR). Both carried a landlord/lessee connotation unsuited to a laundry-business owner reading admin UI. "Organization" / "المنشأة" are the terms Gulf commercial/ERP software uses for a registered business entity — matches what a CleanMateX tenant actually is. Decided 2026-10-01. Rollout to the 35 files currently using "مستأجر" (and the EN equivalent) is a separate follow-up, not done by adding this entry. |
| `base_currency` | Base Currency | العملة الأساسية | Tenant_Currency_FX plan 01 (`org_currency_cf.is_base_currency`). Recurs across the currency/FX screen (5C), and later orders/invoices/payments once 5G wires FX into transactions. Decided 2026-10-01. |
| `reporting_currency` | Reporting Currency | عملة التقارير | Tenant_Currency_FX plan 01 (`org_currency_cf.is_reporting_currency`). Decided 2026-10-01. |
| `exchange_rate` | Exchange Rate | سعر الصرف | Tenant_Currency_FX plan 01 (`org_fx_rate_mst`/`sys_currency_exchange_rate_mst`). Covers both the tenant's own rate book and the HQ reference book — one term for both. Decided 2026-10-01. |
| `multi_currency` | Multi-Currency | تعدد العملات | Tenant_Currency_FX plan 01 — the `multi_currency_fx` feature flag and the progressive-disclosure toggle on the Currencies tab. Decided 2026-10-01. |
| `cash_disposition` | Disposition | التصرف بالنقدية | CLF (ADR-057) — what happens to the counted cash at a drawer close (left in drawer, moved to safe, handed to manager, prepared for deposit, partial removal). Recurs across the close wizard, session detail, print report, and the follow-up screen (`sys_cash_drawer_ses_disp_cd`). Decided 2026-10-01. |
| `cash_drawer` | Cash Drawer | درج النقد | The physical till drawer (POS_Session_Cash_Drawer_Hardening / CLF). "درج" is the accurate translation of a till drawer; "صندوق" means a box or fund and was creeping in, so the catalog read "درج" on checkout/POS screens but "صندوق" on the cash-drawer screens. Decided 2026-10-02; the 94 existing drawer strings were aligned to "درج" in the same pass (singular درج, definite الدرج, plural أدراج). Do not use "صندوق" for a cash drawer. |
| `order_balance` | Balance | الرصيد | What the customer still owes on an order (snapshot `outstanding_amount`), always shown with its word (Due, Due at collection, Settled, Overpaid). Reusable Order Fin View, 2026-11-01. Not "remaining" or "المتبقي" in new copy. |
| `order_settled` | Settled | مسدّد | Nothing is owed on the order. Used for the balance word and the Edit outcome. Reusable Order Fin View, 2026-11-01. |
| `order_overpaid` | Overpaid | مدفوع زيادة | More was received than the order total and the excess is not yet resolved (`overpaid_amount`). Reusable Order Fin View, 2026-11-01. |
| `figures_reconciled` | Reconciled | مطابق | The order's figures agree with their records (D32). Never "Balanced" / "متوازن", which reads as an accounting balance. Reusable Order Fin View, 2026-11-01. |
| `saas_backoffice` | HQ | إدارة المنصة | Usual name for the `cleanmatexsaas` application (platform-web, platform-api, platform-workers). SaaS Backoffice, platform, platform level, Platform HQ Console, SaaS Backoffice Admin and Management, and Headquarters mean the same application. HQ is not a tenant organization's headquarters, المقر, or المقر الرئيسي. "Platform level" means data or behavior owned by HQ. Use HQ. When a reader could confuse it with a tenant headquarters, add the meaning once: HQ (the SaaS Backoffice). Existing code and file identifiers that already contain HQ stay unchanged. Decided 2026-10-22. |
| `organization_app` | Organization app | تطبيق المنشأة | The `cleanmatex` application (web-admin, cmx-api). The same application is also called tenant app, client app, or Tenant-Facing Application. It is not the SaaS Backoffice. The customer business remains Organization / المنشأة (`tenant`). On the first use in a document or screen, write "Organization app" so the later short form is understandable. Decided 2026-10-22. |
| `service_speed` | Service speed | سرعة الخدمة | How fast an order or line is done (`sys_service_speed_cd`: Standard, Express…). Line-Level Money Snapshot, 2026-11-07. Matches `newOrder` / `catalog` copy. |
| `speed_premium` | Speed premium | رسوم السرعة | What a faster speed adds to a line, set by a Speed Pricing rule (`speed_premium_amount`). When it sits inside the line price, say "(included)" / "(مشمولة)". Line-Level Money Snapshot, 2026-11-07. |
| `tax_category` | Tax category | الفئة الضريبية | The tax basis a line carries (`sys_tax_category_cd`: Standard, Zero-rated, Exempt, Out of scope). Matches the catalog product form. Line-Level Money Snapshot, 2026-11-07. |
| `tax_return` | VAT return | الإقرار الضريبي | The periodic return filed with the tax authority; boxes filled from final tax lines (`sys_tax_return_box_cd`). Tax Engine T7, 2026-11-11. |
| `tax_period` | Tax period | الفترة الضريبية | A return period (`org_tax_periods_mst`); closing it stops new final tax lines dated inside it. Tax Engine T7, 2026-11-11. |
| `withholding_tax` | Withholding tax | ضريبة الاستقطاع | Tax kept from a supplier payment for the authority (`wht_amount`). Tax Engine T7, 2026-11-11. |
| `tax_code` | Tax code | رمز الضريبة | One tax with its rate and versions (`org_tax_profiles_cf`, one row per version), e.g. standard VAT 5%. Tax Engine T9, 2026-11-12. |
| `tax_rule` | Tax rule | قاعدة ضريبية | A row that picks the tax codes for a document type, item tax class and party (`org_tax_rules_cf`). Tax Engine T9, 2026-11-12. |
| `tax_kit` | Tax kit | الإعداد الضريبي الجاهز | A ready country tax setup published by HQ (codes, classes, rules, examples), copied to an organization. Tax Engine T9, 2026-11-12. |
| `item_tax_class` | Item tax class | الفئة الضريبية للصنف | How an item is taxed (standard, zero-rated, exempt…); rules match on it. Tax Engine T9, 2026-11-12. |
| `party_tax_class` | Party tax class | الفئة الضريبية للطرف | How a customer or supplier is taxed (registered business, consumer, export…). Tax Engine T9, 2026-11-12. |
| `reverse_charge` | Reverse charge | الاحتساب العكسي | The buyer accounts for the tax instead of the seller; the code records tax without charging it. Tax Engine T9, 2026-11-12. |
| `line_net` | After discounts | بعد الخصومات | A line's amount after its own discount and its share of the order discount, before tax (`net_amount`). Shown as "After discounts", not "Net", in the line breakdown. Line-Level Money Snapshot, 2026-11-07. |
| `cutoff_time` | Cut-off time | آخر وقت للاستلام | The last drop-off counted as today; later orders count from the next working day (`order_cutoff_time`). Service Speeds, 2026-11-08. |
| `ready_time` | Ready time | وقت الجاهزية | When orders promised in working days are ready (`ready_time`). Service Speeds, 2026-11-08. |
| `working_day` | Working day | يوم عمل | A day the branch is open by its Business Calendar, holidays excluded. Service Speeds, 2026-11-08. |

## Adding a new term

1. Search both JSON files for an existing key for the concept — reuse it if found.
2. Pick a stable snake_case key (the concept, not the word).
3. Add the key to **both** `glossary.en.json` and `glossary.ar.json` in the same position/order.
4. Add a row to the table above with the *why*.
5. If existing `messages/**` strings already use the old term, that's a rollout task — list the affected
   files/keys in the PR description or a follow-up note; this file only fixes new copy going forward,
   it doesn't retroactively rewrite the catalog by itself.
