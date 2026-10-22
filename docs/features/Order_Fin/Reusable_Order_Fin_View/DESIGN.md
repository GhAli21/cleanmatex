# Reusable Order Financial View — Structure and UI Design (Discussion)

**Status:** PROPOSAL — under owner discussion (2026-10-22). Nothing here is approved until the owner confirms. Agreed points then move into [PLAN.md](PLAN.md).
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

- **One mapping path for saved and unsaved orders.** The payment-modal draft (§6.3 of the plan) is fed into the **same** builders (step 3) as a draft "source set". Only step 2 differs. Saved and unsaved orders cannot drift apart.
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
    order-changes.source.ts receipts.source.ts   cash-handling.source.ts (if P0 confirms a link)
  projections/public.projection.ts

web-admin/src/features/orders/order-fin-view/        (isomorphic + UI)
  model/       view types, section payload types, config types
  config/      presets.ts, resolve-display-config.ts, section-sources.ts
  build/       one pure builder per section, build-header.ts, build-timeline.ts, assemble.ts
  draft/       map-draft-to-source-set.ts  (payment-modal-v4 input → source set, no math)
  ui/          components (§2)
  hooks/       use-order-financial-view.ts, invalidate-order-financial.ts
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
  isDraft: boolean;
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

interface OrderFinLine {
  id: string;
  labelKey?: string;                 // i18n key, e.g. for status words
  label?: { en: string | null; ar: string | null };  // DB bilingual names (name/name2)
  amount: number;                    // already rounded to 4 dp
  sign: 'plus' | 'minus' | 'neutral';
  state: 'normal' | 'pending' | 'failed' | 'voided' | 'reversed';
  countsInTotal: boolean;            // false for pending, failed, voided: shown, not summed
  meta?: { dateIso?: string; methodCode?: string; ref?: string; statusCode?: string };
}
```

- **Labels:** the server returns i18n **keys** for fixed words and **both** DB names (`name`/`name2`) for data-driven labels. The UI picks by locale. The server never returns translated text.
- **Status codes:** passed through exactly as stored (CRITICAL RULE #12); the UI translates them by key.
- **`countsInTotal`** makes the rule "voided, pending and failed rows are visible but not summed" explicit in the data, not hidden in UI code.

### Client data flow

- `useOrderFinancialView(source, config)`: TanStack Query key `['order-fin-view', orderId, requiredSourcesKey]`, `staleTime: 0`, refetch on window focus. Money must never look fresh when it isn't.
- `invalidateOrderFinancial(queryClient, orderId)`: one helper, called after payment, refund, charge void, order-edit apply and tax-document issue.
- Server pages may pass pre-built `data` (`source.kind = 'data'`) to avoid a second request.

---

## 2. UI design proposal

### 2.1 Layout backbone: a money statement, not a card wall

The view reads top-down like an accountant's statement. Order value builds up to the **Total**, settlement reduces it to the **Balance**. Every section is one row of that statement, and the row expands in place. This maps directly onto the five section modes.

**Wide screens (≥ 1024 px), preset `detailed`:**

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ORDER #10234 · OMR            [Partially paid] [Pay on collection]  Detailed|Full │
│                                                                               │
│   BALANCE DUE            Total 12.500   Paid 8.000   Credits 1.000   Refunded 0 │
│   3.500  ●                                                                    │
├──────────────────────────────────────┬────────────────────────────────────────┤
│ ORDER VALUE                          │ SETTLEMENT                             │
│ ▸ Items & extras            10.000   │ ▾ Payments (2)                 −8.000  │
│ ▸ Charges                    1.500   │     Cash · 22 Oct 10:41          5.000 │
│ ▸ Discounts (1)             −0.500   │     Card · 22 Oct 10:42          3.000 │
│ ▸ Tax (VAT 5%)               1.500   │     Card · pending ⏳ (not counted) 2.000 │
│ ──────────────────────────────────── │ ▸ Credits (gift card)          −1.000  │
│   Total                     12.500   │ ▸ Refunds                       0.000  │
│                                      │ ──────────────────────────────────────  │
│                                      │   Balance due                   3.500  │
├──────────────────────────────────────┴────────────────────────────────────────┤
│ RECORDS   ▸ Invoices (1)  ▸ Tax documents (1)  ▸ Vouchers (3)  ▸ Loyalty +12 pts │
│           ▸ Order changes (1)  ▸ Timeline                                     │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Narrow screens, sheets and the payment-modal dialog (`density="compact"`):** a single column. Order Value, then Settlement, then Records. The header shrinks to the hero metric plus two others.

```
┌──────────────────────────────┐
│ [PREVIEW — not yet saved]     │  ← draft only
│ Balance due          3.500 ●  │
│ Total 12.500 · Paid 8.000     │
├──────────────────────────────┤
│ ▸ Items & extras      10.000  │
│ ▸ Charges              1.500  │
│ ▸ Discounts           −0.500  │
│ ▸ Tax                  1.500  │
│   Total               12.500  │
│ ▸ Payments            −8.000  │
│ ▸ Credits             −1.000  │
│   Balance due          3.500  │
└──────────────────────────────┘
```

### 2.2 Section row anatomy

`[chevron] Title (count) [state chips]  ……………  amount`

- **Chevron:** only in `expandable`/`expanded`. Mirrored in RTL.
- **Count:** number of lines, for example "Payments (2)".
- **State chips:** only when they matter, for example "1 pending" or "1 voided". Always text plus icon, never color alone.
- **Amount:** end-aligned (right in LTR, left in RTL), tabular numerals, currency decimal places from the **order** currency.
- **Detail lines:** label · meta (method, date, short ref) · amount. Voided, failed or reversed lines are struck through and muted, with a chip. Pending lines carry "not counted". This visual follows `countsInTotal`.
- **More than 8 lines in a section:** show the first 8 plus "Show all (n)". `full`/`audit` show everything.

### 2.3 Money and color rules

- **Neutral by default:** amounts are plain foreground color. Color marks **state only**: balance due (warning tone), settled (success tone), overpaid (info tone), voided or failed (muted).
- **Signs:** reductions (discounts, payments, credits) are shown with a minus sign and no color. This avoids "green = money left the order?" confusion.
- **Theme tokens only**, no raw Tailwind palette colors (BF-18). Dark mode comes for free.
- **Hero metric** (`emphasize`, default `balance`): large, with a status word ("Settled", "Due", "Overpaid") so it isn't color-only.

### 2.4 Header

- The hero metric on the start side, secondary metrics inline beside it (config `metrics`).
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
- **Public:** customer wording ("Amount due", "Paid by card"), no internal codes, and a slightly larger type scale for phone screens.

### 2.7 Accessibility and RTL

- Rows are buttons with `aria-expanded` and `aria-controls`; keyboard: Enter/Space toggle, arrow keys move between rows.
- The hero amount has a full text label for screen readers ("Balance due 3.500 Omani rials").
- Logical CSS properties only (`ms-`/`me-`, `text-start`/`text-end`). Mirrored chevrons. Arabic digits follow the existing money formatter's locale handling.

### 2.8 Shared Cmx pieces (CRITICAL RULE #17)

| Need | Plan |
|---|---|
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

## 4. Questions for the owner

1. **Backbone:** the money statement with in-place expansion (§2.1), or a different style?
2. **Grouping:** three groups (Order Value, Settlement, Records), two columns on wide screens. OK?
3. **Color rule:** neutral amounts, color for state only, minus sign for reductions (§2.3). OK?
4. **Lines vs tables:** lines with a "Show all" cap at 8. OK?
5. **Structure:** the five-step pipeline, with the draft feeding the same builders, and `getOrderFinancialSummary` split into sources with a compatibility wrapper. OK?
6. **Mockup:** would an interactive HTML mockup (presets, modes, RTL, dark mode) help before approval?
