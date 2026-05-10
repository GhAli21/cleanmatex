# Gift Card V2 — Deferred Features
# Future - To be Implemented In Future
 
Features intentionally deferred from Gift Card V1. All items here are
out-of-scope for `gift_card_v1_35b71bc5.plan.md` and must not be
implemented until a dedicated V2 plan is approved.

---

## 1. QR Code Support

**Scope:**
- Generate QR code on gift card issue (print and digital).
- POS scanner: camera-based QR scan with fallback to manual code entry.
- Define QR payload schema: encode `gift_card_code` only (PIN always typed separately for security).
- Library choices to evaluate: `qrcode` (generation), `html5-qrcode` or `@zxing/library` (scanning).
- Handle camera permission request and denial gracefully.
- Tenant setting: `gift_card_qr_enabled` (boolean).
- Add QR display to print receipt and digital card screens.

**Why deferred:** Camera API, library integration, and QR payload design require a separate UX spike. V1 covers manual code entry which is sufficient for POS launch.

---

## 2. Scheduled Expiry Cron Job

**Scope:**
- A Supabase `pg_cron` function or external cron task that runs `expireGiftCards(tenantOrgId)` daily for all active tenants.
- The function already exists; what is missing is the scheduler that calls it.
- The cron should: query all tenants, call expire per tenant, log results (cards expired count, any errors).
- Alternatively, implement via a Next.js/NestJS scheduled job using the existing cron infrastructure.
- Alert if the job fails for any tenant.

**Why deferred:** V1 supports manual admin expiration. Automated scheduling requires infrastructure decision (pg_cron vs. application-level cron) that is shared across other features.

---

## 3. Extended ERP Lifecycle Events

**Scope:**
Add ERP posting events for the following gift card lifecycle moments not covered in V1:

| Event | Trigger | Accounting Treatment |
|---|---|---|
| `GIFT_CARD_ACTIVATED` | Card transitions GENERATED → ACTIVE | Start liability recognition |
| `GIFT_CARD_SUSPENDED` | Admin suspends card | Freeze liability (informational) |
| `GIFT_CARD_ADJUSTMENT` | Admin credit/debit adjustment | Dr/Cr based on direction vs. liability account |

These complement the V1 events (`SOLD`, `REDEEMED`, `EXPIRED`, `REFUNDED`, `VOIDED`, `BONUS_GRANTED`).

**Why deferred:** V1 covers the financially significant events. Lifecycle tracking events are useful for audit but not critical for launch accounting accuracy.

---

## 4. Breakage Revenue Timing Policy

**Scope:**
- Define and configure when breakage revenue is recognized after expiry.
- Options: immediate on expiry date, proportional recognition over remaining balance lifetime, deferred until statutory period ends.
- This is jurisdiction-dependent (GAAP vs. IFRS vs. local GCC accounting rules).
- Implement a tenant setting for breakage policy: `IMMEDIATE`, `PROPORTIONAL`, `DEFERRED_DAYS`.
- Implement the proportional or deferred journal posting logic in ERP Lite.

**Why deferred:** V1 posts breakage at the expiry trigger (`GIFT_CARD_EXPIRED` event → `Dr Liability, Cr Breakage Revenue`). The timing is always immediate in V1. Multi-policy support requires accounting design review with finance team.

---

## 5. Customer Notifications

**Scope:**
- Email or SMS notification when a gift card is issued to a customer (`issued_to_customer_id` non-null).
- Notification content: card code (masked or full based on security policy), face value, expiry date, redemption instructions.
- Low-balance warning notification (e.g., balance < 10% of original).
- Expiry warning notification (e.g., 14 days before expiry date).
- Notification channel: integrate with the existing notification service/provider.
- Tenant setting to enable/disable each notification type.

**Why deferred:** Notification infrastructure and template management are cross-feature concerns. V1 relies on staff handing card details to customers at POS.

---

## 6. Customer App — Claim, Wallet, Balance

**Scope:**
- Customer self-service: enter a gift card code to claim an anonymous physical card (sets `issued_to_customer_id`).
- Customer wallet: list all gift cards issued or claimed by the logged-in customer.
- Balance lookup: customer can check remaining balance without going to POS.
- Redemption in customer-initiated orders (if customer-facing ordering is implemented).

**Why deferred:** V1 is admin/POS-only. Customer app interactions require a separate auth context (customer JWT, not staff JWT) and a customer-facing API design.

---

## 7. HQ / Cross-Tenant Features (cleanmatexsaas)

Already noted in V1 scope as deferred. Includes:
- Platform-wide gift card templates and campaigns.
- Cross-tenant gift card analytics and liability monitoring.
- Central breakage revenue aggregation.
- Platform admin controls for enabling/disabling gift cards per tenant.

These belong in `cleanmatexsaas` and require a separate cross-project approval flow following the Cross-Project Feature Checklist.

---

## Notes

- Do not implement any item above as part of the V1 milestone.
- When V2 planning begins, create a new plan file referencing this document and the V1 plan as baseline.
- The V1 plan is at: `docs/dev/plans/gift_card_v1_35b71bc5.plan.md`.
