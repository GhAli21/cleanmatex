# Rack & Bags Modal — Testing Guide & Scenarios

**Prerequisite:** migration `0497_org_orders_locker_hanging.sql` must be applied to the environment you're testing against first (Supabase local/remote, per your normal migration flow). None of the scenarios below will work until `org_orders_mst.locker_location`, `locker_code`, and `hanging_count` exist.

## Automated coverage already run this session

- `npx eslint . --quiet` — clean, no new warnings.
- `npm run typecheck` (`tsc --noEmit`) — clean.
- `npm run build` — green, all routes compiled.
- `npm run check:i18n` — passed, no new orphans/mismatches.
- Targeted regression sweep: `__tests__/features/workflow`, `__tests__/features/orders`, `__tests__/ui` — 70 suites / 623 tests, all passing.
- New unit tests: `__tests__/ui/cmx-count-picker.test.tsx` (6/6), `__tests__/features/workflow/rack-gate-helpers.test.ts` (4/4).

## Manual scenarios (owner-runnable)

### Scenario 1 — Ready Details: blocked release opens the modal, one click completes it

1. Go to **Ready** (sidebar → Ready) → open any order with status `ready` and **no rack assigned**: `/dashboard/ready/[id]`.
2. Confirm the "Make available for pickup" button is present and a "Rack & Bags" outline button sits below it.
3. Click **Make available for pickup**. The Rack & Bags modal should open (not a failed/blocked click).
4. Enter a Rack value (required), optionally Locker + Code, adjust Bags/Hanging via the chip pickers (try clicking "Custom" on one and typing a number > 7).
5. Click **Submit**. Expect: a "Rack & bags details saved" toast, the modal closes, and — because this was triggered by the blocked release button — the release action fires automatically in the same flow (no second click needed). Expect an "action succeeded" toast and the page to reflect the new status.

### Scenario 2 — Proactive "Rack & Bags" button (no auto-release)

1. Open a `ready` order that **already has a rack assigned** (release button enabled).
2. Click the secondary **Rack & Bags** button (not the release button).
3. Change the Bags/Hanging counts or Locker/Code, Submit.
4. Expect: fields save, a success toast appears, but the order is **not** released — the release button still requires its own separate click. This confirms the proactive button never side-effects a release.

### Scenario 3 — Cross-order conflict banner

1. Pick a customer with at least one other active order that already has a rack or locker assigned (any status other than delivered/closed/cancelled).
2. Open a *different* order for that same customer and click "Rack & Bags" (or trigger it via a blocked action).
3. Expect a yellow warning banner: "Customer has orders on rack(s): {count} B:{bags} H:{hanging}", plus the specific order number(s) listed underneath for manual verification.

### Scenario 4 — Reaches other screens via WorkflowActionBar

1. Open an order on **Processing** or **Packing** (`/dashboard/processing/[id]` or `/dashboard/packing/[id]`) whose next action is blocked *only* by a missing rack.
2. Click that action button. Expect the same Rack & Bags modal to open (proves the fix is cross-cutting, not Ready-only).
3. Submit — expect the action to retry and complete in one click, same as Scenario 1.

### Scenario 5 — Arabic / RTL

1. Switch the app language to **العربية** (top-right language switcher).
2. Repeat Scenario 1. Confirm: dialog title/labels are in Arabic, the Bags/Hanging chip rows render right-to-left, and no English text leaks through (no missing-key fallback).

### Scenario 6 — Tenant isolation (technical/dev check)

1. As a signed-in tenant user, hit `GET /api/v1/orders/<an-order-id-from-a-different-tenant>/rack-bags` directly (e.g. via browser devtools or curl with your session cookie).
2. Expect a 404 (`Order not found`), never another tenant's data.

## Known, intentional behavior (not bugs)

- The Custom count input clamps to its ceiling (100 for Bags; no DB ceiling for Hanging, but the UI still caps to a sane 9999) and reflects the clamped number back in the field.
- Hanging count can be `0` or left as `NULL` in the database — both are valid.
- If the field save succeeds but the automatic release retry fails for an unrelated reason (e.g., a different gate newly blocks it), the fields are still saved — only the release action needs a normal follow-up click.
