# Reusable Order Financial View — Structure and UI Design (Discussion)

**Status:** DECIDED, pending owner sign-off after the mockup review (2026-10-23). The owner delegated the six §4 questions ("you decide, best, flexible, future-proof"), and they are answered in §4. **v2 (2026-10-23):** external review folded in. The line contract and header metrics now follow PLAN §6.6, the wireframe is corrected, and the decisions are recorded in PLAN D29–D35.
**Interactive mockup:** https://claude.ai/artifact/Kc2iHiAdb47pJFzn1mjXaC (private to the owner until shared).
**Related:** [PLAN.md](PLAN.md) · [STATUS.md](STATUS.md)

---

## 1. Service structure — a pipeline with five pure steps

Each step has one job and one direction of data flow. Only step 2 touches the database.

```
 config ─▶ (1) RESOLVE ─▶ (2) LOAD ─▶ (3) BUILD ─▶ (4) ASSEMBLE ─▶ (5) PROJECT ─▶ view
          what to show   fetch only   pure: rows   header,        public / none
          + which data   what's       → section    warnings,
          sources        needed       payloads     timeline
```

| Step | Module | Runs on | Pure? | Job |
|---|---|---|---|---|
| 1 Resolve | `resolveOrderFinDisplayConfig(config)` → `{ sections: modes, header, requiredSources }` | client + server | yes | Merges preset + overrides. Works out the **minimum** set of data sources. A section in `total` mode needs only the snapshot; `expandable`/`expanded`/`detail` also need its fact rows. |
| 2 Load | Source registry: one `OrderFinSource` per table group | server only | no (DB) | Each source has a `key`, a `load(ctx)` with an explicit `tenant_org_id` filter, and returns `{status:'ok',data} \| {status:'error',code}`. The **core** source (the order snapshot row) always loads first; the rest run in parallel. |
| 3 Build | One builder per section: `buildPaymentsSection(core, sources)` | client + server | yes | Turns rows into a section payload: total line(s), detail lines, counts and badges. **No new money math:** totals come from the snapshot, and any derivation calls `order-financial-aggregation.ts`. |
| 4 Assemble | `assembleOrderFinancialView(...)` | client + server | yes | Header metrics, warnings (from the shared reconciliation rule source, BF-14), the merged timeline, `schemaVersion`, `generatedAt`, `snapshotStatus`. |
| 5 Project | `projectOrderFinancialViewForPublic(view)` | server only | yes | Allowlist projection for public and customer-portal callers. Otherwise identity. |

### Why this shape

- **One mapping path for saved, draft and edit.** The payment-modal draft (PLAN §6.3) and the Order Edit quote (PLAN §6.4) are first turned into the **same normalized section input** the saved-order sources produce. Then the **same** builders (step 3) run. Builders never accept raw `org_order_*` rows or fake rows shaped like them. Only step 2 differs, so saved, draft and edit cannot drift apart.
- **Adding a source or section is local:** one source file plus one builder file plus one registry line. No central switch statement to edit.
- **Performance by construction:** hidden sections are never loaded; `total`-mode sections cost nothing beyond the snapshot row.
- **Failure isolation:** a failed source marks only its own section `error`. The header depends only on the core snapshot.
- **Testability:** steps 1, 3, 4 and 5 are pure, so golden fixtures can test them without a database.

### Proposed folders

```
web-admin/lib/services/order-fin-view/              (server-only)
  index.ts                         public server API
  order-fin-view.service.ts        getOrderFinancialView(tenantId, orderId, resolved)
  order-fin-headers.service.ts     getOrderFinancialHeaders(tenantId, orderIds[])  (batch, ≤100)
  sources/
    registry.ts                    key → source
    core.source.ts                 org_orders_mst snapshot (always)
    charges.source.ts  discounts.source.ts  taxes.source.ts
    payments.source.ts credits.source.ts    refunds.source.ts
    overpayment.source.ts  receivable.source.ts  tax-documents.source.ts
    vouchers.source.ts     loyalty.source.ts     adjustments.source.ts
    order-changes.source.ts receipts.source.ts
  projections/public.projection.ts

web-admin/src/features/orders/order-fin-view/        (isomorphic + UI)
  model/       view types, section payload types, config types
  config/      presets.ts, resolve-display-config.ts, section-sources.ts
  build/       one pure builder per section, build-header.ts, build-timeline.ts, assemble.ts
  draft/       map-draft-to-source-set.ts  (payment-modal-v4 input → normalized input, no math)
  edit/        map-edit-quote-to-source-set.ts (saved context + quote → normalized input, no math)
  ui/          components (§2)
  hooks/       use-order-financial-view.ts, use-order-edit-financial-quote.ts, invalidate-order-financial.ts
```

### Fate of the existing code

- `getOrderFinancialSummary` is **split into the sources above**, then kept as a thin **compatibility wrapper** that calls them. The `financial-summary` route, `refund-initiate.ts` and other callers keep working with no contract change.
- `map-order-financial-summary-view.ts` is fixed in Phase 1, then its logic moves into the section builders. The old function becomes a wrapper until P6 removes its last caller.
- The existing `order-financial/*` panels are refactored into section renderers (their visual work is reused, not thrown away).

### Data contract highlights

```ts
interface OrderFinancialView {
  schemaVersion: 1;
  orderId: string | null;            // null for drafts
  orderNo: string | null;
  currency: { code: string; decimalPlaces: number };   // order currency, not tenant (BF-18)
  snapshotStatus: string;            // DB value as-is (CURRENT / RECALCULATION_REQUIRED …)
  sourceKind: 'saved' | 'draft' | 'edit';
  currencyKnown: boolean;            // false → "Currency unknown" state, never a default
  generatedAt: string;
  header: OrderFinHeaderPayload;     // all metrics; UI picks per config
  sections: Partial<Record<OrderFinSectionKey, OrderFinSectionPayload>>;
  warnings: FinancialWarning[];
}

interface OrderFinSectionPayload<TLine = OrderFinLine> {
  key: OrderFinSectionKey;
  status: 'ok' | 'empty' | 'error' | 'notApplicable' | 'forbidden';
  totals: OrderFinTotalLine[];       // what 'total' mode shows (usually one line)
  lines?: TLine[];                   // only when the section was loaded in a detail mode
  counts?: Record<string, number>;   // e.g. { completed: 2, pending: 1 }
  warningCodes?: string[];           // inline markers on this section
}

// OrderFinLine: the canonical definition is PLAN §6.6 (unit, role, countsInTotal, previousAmount).
```

- **Labels:** the server returns i18n **keys** for fixed words and **both** DB names (`name`/`name2`) for data-driven labels. The UI picks by locale. The server never returns translated text.
- **Status codes:** passed through exactly as stored (CRITICAL RULE #12); the UI translates them by key.
- **`countsInTotal`** makes the rule "voided, pending and failed rows are visible but not summed" explicit in the data, not hidden in UI code.
- **`unit` and `role`** keep points out of money sums, keep included extras from being added twice, and keep informational amounts (document totals, voucher face values, deltas) out of the amount column (PLAN §6.6).

### Client data flow

- `useOrderFinancialView(source, config)`: TanStack Query key `['order-fin-view', tenantId, orderId, sourceKind, requiredSourcesKey]` (PLAN PR-21), `staleTime: 0`, refetch on window focus and reconnect. Money must never look fresh when it isn't.
- `invalidateOrderFinancial(queryClient, orderId)`: one helper, called after payment, refund, charge void, order-edit apply and tax-document issue.
- Server pages may pass pre-built `data` (`source.kind = 'data'`) to avoid a second request.

---

## 2. UI design proposal

### 2.1 Layout backbone: a money statement, not a card wall

The view reads top-down like an accountant's statement. Order value builds up to the **Total**, settlement reduces it to the **Balance**. Every section is one row of that statement, and the row expands in place. This maps directly onto the five section modes.

The figures below are golden sample **G1** (PLAN P0-02): partially paid, pay on collection, OMR, VAT 5% after discounts, charges flat and non-taxable (B18). The mockup uses the same figures.

**Wide screens (≥ 1024 px), preset `detailed`:**

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ORDER #10234 · OMR          [Partially paid] [Pay on collection] [✓ Reconciled]   │
│                                                                                  │
│  DUE AT COLLECTION  ⚠ Due        Total 11.475 · Paid 8.000 · Credits 1.000        │
│  2.475                                                                           │
├────────────────────────────────────────┬─────────────────────────────────────────┤
│ ORDER VALUE                            │ SETTLEMENT                              │
│ ▾ Items & extras              10.000   │ ▾ Payments (2 · 1 pending)      −8.000  │
│     Items (6 pieces)           9.000   │     Cash · 10:41                 5.000  │
│     Piece extras               0.500   │     Card ••4821 · 10:42          3.000  │
│     Preference extras          0.500   │     Card ••9310 ⏳ Pending ·             │
│ ▾ Charges (1 voided)           1.500   │       not counted                2.000  │
│     Delivery                   1.000   │ ▾ Credits (1)                   −1.000  │
│     Express                    0.500   │     Gift card GC-7781 · Applied  1.000  │
│     Service ⊘ Voided ·                 │ ─────────────────────────────────────── │
│       not counted              0.300   │   Due at collection              2.475  │
│ ▸ Discounts (1)               −0.500   │                                         │
│ ▸ Tax (VAT 5%)                 0.475   │                                         │
│ ────────────────────────────────────── │                                         │
│   Total                       11.475   │                                         │
├────────────────────────────────────────┴─────────────────────────────────────────┤
│ RECORDS   ▸ Tax documents (1) · Simplified tax invoice TI-000318,                 │
│             document total 11.475            ← informational: no amount column    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ CONTROL   (Release 2: reconciliation detail, debug)                              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Notes on this picture:
- The hero carries a **word** ("Due"), not a color dot. On a pay-on-collection order the balance reads "Due at collection". There is **no** separate receivable or pay-on-collection number (D31).
- Empty sections (refunds, overpayment, receivable without an AR invoice) are hidden; `full` and `audit` show them as a muted "None".
- The voided charge and the pending payment are visible and `countsInTotal: false`. The additive counted lines add up to each section total.
- The badge says "Reconciled" (D32). The header stays short in every preset (D31).

**Narrow screens, sheets and the payment-modal dialog (`density="compact"`):** a single column. Order Value, then Settlement, then Records. The header shrinks to the hero metric plus two others.

```
┌──────────────────────────────┐
│ [PREVIEW — not yet saved]     │  ← draft only
│ Due at collection   ⚠ Due     │
│ 2.475                         │
│ Total 11.475 · Paid 8.000     │
├──────────────────────────────┤
│ ▸ Items & extras      10.000  │
│ ▸ Charges              1.500  │
│ ▸ Discounts           −0.500  │
│ ▸ Tax                  0.475  │
│   Total               11.475  │
│ ▸ Payments            −8.000  │
│ ▸ Credits             −1.000  │
│   Due at collection    2.475  │
└──────────────────────────────┘
```

**Order Edit live card (edit sample E1: one 2.000 item added; promo 5% re-rated; VAT on the discounted base):**

```
┌──────────────────────────────────────────┐
│ [ Review ]                                │  ← no money on the button (D33)
├──────────────────────────────────────────┤
│ New total 13.470      was 11.475 (+1.995) │
│ Already paid and credited         9.000   │
│ To collect                        4.470   │
│ [To collect · OUTSTANDING]   Details ›    │  ← chip mapped from the exact outcome code
│ Updating…  (last confirmed figures, dimmed)│  ← only while a quote is in flight
└──────────────────────────────────────────┘
Details: Items 10.000 → 12.000 · Promo SPRING5 −0.500 → −0.600 · VAT 0.475 → 0.570
```

### 2.2 Section row anatomy

`[chevron] Title (count) [state chips]  ……………  amount`

- **Chevron:** only in `expandable`/`expanded`. Mirrored in RTL.
- **Count:** number of lines, for example "Payments (2)".
- **State chips:** only when they matter, for example "1 pending" or "1 voided". Always text plus icon, never color alone.
- **Amount:** end-aligned (right in LTR, left in RTL), tabular numerals, currency decimal places from the **order** currency.
- **Detail lines:** label · meta (method, date, short ref) · amount. Voided, failed or reversed lines are struck through and muted, with a chip. Pending lines carry "not counted". This visual follows `countsInTotal`.
- **More than `lineCap` lines in a section (default 8):** show the first 8 plus "Show all (n)" and "Show less". `audit` and `print` show everything.

### 2.3 Money and color rules

- **Neutral by default:** amounts are plain foreground color. Color marks **state only**: balance due (warning tone), settled (success tone), overpaid (info tone), voided or failed (muted).
- **Signs:** reductions (discounts, payments, credits) are shown with a minus sign and no color. This avoids "green = money left the order?" confusion.
- **Theme tokens only**, no raw Tailwind palette colors (BF-18). Dark mode comes for free.
- **Hero metric** (`emphasize`, default `balance`): large, with a status word ("Due", "Due at collection", "Settled", "Overpaid") so it isn't color-only. There is no color dot.
- **Points** are never shown as money: "+11 pts" in the line text, no currency.
- **Informational amounts** (document totals, voucher face values, was → now deltas) sit in the line text, never in the end-aligned amount column, so that column always means "counts toward this section".

### 2.4 Header

- The hero metric on the start side, secondary metrics inline beside it (config `metrics`). **The header is the answer, not a dump:** at most hero + three metrics in every preset, `full` and `audit` included (D31). A ten-metric strip wraps badly in Arabic, and the statement already holds the rest.
- The reconciliation badge says "Reconciled", "Figures differ" or "Recalculating", never "Balanced" (D32).
- Translated badges: payment status and settlement type (BF-17).
- Top-end corner: the preset switcher (Detailed | Full) when `presetSwitcher` is set, plus "Expand all / Collapse all".
- Snapshot not current (`RECALCULATION_REQUIRED`): a warning bar under the header, "Figures are being recalculated", never silent.
- Warnings: a count chip ("2 warnings") that opens the list. Affected sections also get an inline marker.

### 2.5 Containers (`layout`)

| Layout | Used by | Look |
|---|---|---|
| `card` | detail page, AR invoice detail | Each group (Value, Settlement, Records) in a `CmxCard` |
| `plain` | inside tabs or existing cards | No outer chrome |
| `sheet` | payment-modal dialog, handover side panels | Compact, single column, sticky header |
| `print` | `*-rprt.tsx` reports | Expanded per config, no chevrons or switcher, black and white, A4 statement |

### 2.6 States

- **Loading:** skeleton shaped like the statement (header plus rows).
- **Section error:** that row shows "Couldn't load" plus Retry. The rest of the view stays usable.
- **Empty sections:** hidden, except in `full`/`audit`, where they show a muted "None".
- **Draft:** a "Preview — not yet saved" chip and a dashed outline.
- **Order lifecycle states (PLAN PR-09):**
  - **cancelled:** a banner plus the cancel disposition, never a live balance
  - **snapshot missing or legacy:** "Financial data unavailable", never zeros
  - **unknown currency:** an explicit state
  - **core source failed:** the whole view shows an error with Retry and no partial figures
- **Edit concurrency (PR-07):** "This order changed — figures refreshed", and a fresh Review is required.
- **Public:** customer wording ("Amount due", "Paid by card"), no internal codes, and a slightly larger type scale for phone screens.

### 2.7 Accessibility and RTL

- Rows are buttons with `aria-expanded` and `aria-controls`; keyboard: Enter/Space toggle, arrow keys move between rows.
- The hero amount has a full text label for screen readers ("Balance due 3.500 Omani rials").
- Logical CSS properties only (`ms-`/`me-`, `text-start`/`text-end`). Mirrored chevrons. Arabic digits follow the existing money formatter's locale handling.

### 2.8 Shared Cmx pieces (CRITICAL RULE #17)

| Need | Plan |
|---|---|
| Statement layout (D36) | **New** domain-agnostic `CmxStatement` / `CmxStatementGroup` / `CmxStatementRow` / `CmxStatementLine` in `src/ui/data-display`. They know nothing about orders; `order-fin-view` maps order data onto them, so other statements (AR invoice, customer account) can reuse them. |
| Expandable row | **New** `CmxCollapsibleSection` in `src/ui/data-display` (no collapsible exists today) |
| Money text | Promote `order-financial-money-value.tsx` into a shared `CmxMoneyText` with tokens and order-currency decimals, or extend an existing money component if P5 finds one |
| Segmented preset switch | Reuse the existing tabs primitive if it supports a compact segmented style; otherwise extend it (backward compatible) |
| Header metrics | `CmxKpiStatCard` for the `cards` layout; a light inline metric for `inline`/`compact` |
| Chips | `Badge` |

---

## 3. Alternatives considered

| Option | Why not (proposed) |
|---|---|
| **Card grid** (today's summary cards + panels) | Good for glancing, weak at showing *how* the total and balance are reached. Cards don't nest naturally into total → detail modes. Kept only as the header's `cards` layout. |
| **Tabs per area** (Value / Payments / Invoices…) | Hides the relationships; the user can't see total and balance together with their parts. Pages can still put the view inside their own tabs. |
| **Data table for every section** | Heavy for 1–3 rows and poor on phones. Lines with a "Show all" cap cover both. |
| **One giant server mapper** (today) | Couldn't serve drafts, loads everything always, and new sources mean editing one big function. |

---

## 4. Decisions (delegated by the owner, 2026-10-23)

| # | Question | Decision | Why it is the flexible, future-proof choice |
|---|---|---|---|
| D14 | Backbone | **The money statement with in-place expansion.** The card grid survives only as the header's `cards` layout. | One structure serves all five section modes, all presets and all four layouts. A card grid can't express "total → details" without a second design. |
| D15 | Grouping | **Four groups: Order value, Settlement, Records, Control.** Value and Settlement sit side by side on wide screens; Records and Control span the full width. **`items` and `charges` become two sections** (they replace `valueBreakdown`), so callers control each independently. Group order and section order stay configurable (`groupOrder`, `sectionOrder`). | Control (reconciliation and debug) is a separate audience from business records, so it gets its own group. Splitting items and charges gives finer caller control at no cost. |
| D16 | Color and sign | **Neutral amounts; color for state only, always paired with a word or icon; minus sign for reductions; theme tokens only.** | Readable in light, dark, print and for color-blind users. No "green = money out?" ambiguity. |
| D17 | Lines vs tables | **Lines**, with a configurable `lineCap` (default 8), "Show all (n)" and "Show less". `audit` and `print` show everything. A future `detailRenderer: 'lines' \| 'table'` per section is reserved in the contract (not built now). | Lines work at every width, including phones. The reserved option lets a heavy section (for example the timeline) switch to a table later without a contract change. |
| D18 | Structure | **The five-step pipeline (§1)**, the draft feeding the same builders, and `getOrderFinancialSummary` split into sources behind a compatibility wrapper. | Adding a source or section is two files plus a registry line. Saved and draft can't drift, and existing callers keep working. |
| D19 | Mockup | **Built:** the interactive mockup linked at the top. | Lets the owner check presets, modes, header, layouts, AR/RTL and dark mode before approving. |

**Contract additions from D15 and D17**, now folded into PLAN §6 (v5): `lineCap?: number`, `groupOrder?: OrderFinGroupKey[]`, a reserved `detailRenderer?: Partial<Record<OrderFinSectionKey, 'lines' | 'table'>>`, and the section keys `items` and `charges` in place of `valueBreakdown`.
