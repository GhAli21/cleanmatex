# Notification Hub — WhatsApp Template Submission

**Last Updated:** 2026-06-11  
**Purpose:** Submit the 5 required WhatsApp message templates to META for approval before enabling the WhatsApp channel.

> **BLOCKING:** All business-initiated WhatsApp messages (outbound) require pre-approved templates. Free-form text is only allowed within a 24-hour window after the customer sends a message first. Do NOT enable the WhatsApp channel in production until at least the UTILITY templates are approved.

---

## Template Submission via META Business Manager

1. Go to [business.facebook.com](https://business.facebook.com)
2. Navigate to **WhatsApp Manager** → **Message Templates**
3. Click **Create Template**
4. Fill in the fields below for each template

---

## Template 1 — Order Ready

| Field | Value |
|-------|-------|
| **Template name** | `cmx_order_ready` |
| **Category** | UTILITY |
| **Language** | English (en) |

**Body (EN):**
```
Your order #{{1}} is ready for pickup at {{2}}.

Thank you for choosing CleanMateX! 🧺
```

**Arabic (ar) body:**
```
طلبك رقم #{{1}} جاهز للاستلام في {{2}}.

شكراً لاختيارك CleanMateX! 🧺
```

**Variables:**
| Variable | Maps to | Example |
|----------|---------|---------|
| `{{1}}` | Order number | `ORD-2026-00123` |
| `{{2}}` | Branch name / address | `Al Quoz Branch` |

---

## Template 2 — Order Cancelled

| Field | Value |
|-------|-------|
| **Template name** | `cmx_order_cancelled` |
| **Category** | UTILITY |
| **Language** | English (en) |

**Body (EN):**
```
Your order #{{1}} has been cancelled.

Reason: {{2}}

If you have questions, please contact us.
```

**Arabic (ar) body:**
```
تم إلغاء طلبك رقم #{{1}}.

السبب: {{2}}

إذا كان لديك استفسار، يرجى التواصل معنا.
```

**Variables:**
| Variable | Maps to | Example |
|----------|---------|---------|
| `{{1}}` | Order number | `ORD-2026-00123` |
| `{{2}}` | Cancellation reason | `Customer request` |

---

## Template 3 — Payment Received

| Field | Value |
|-------|-------|
| **Template name** | `cmx_payment_received` |
| **Category** | UTILITY |
| **Language** | English (en) |

**Body (EN):**
```
Payment confirmed ✅

Amount: {{1}} {{2}}
Order: #{{3}}

Thank you! Your receipt has been sent to your email.
```

**Arabic (ar) body:**
```
تم تأكيد الدفع ✅

المبلغ: {{1}} {{2}}
الطلب: #{{3}}

شكراً لك! تم إرسال الإيصال إلى بريدك الإلكتروني.
```

**Variables:**
| Variable | Maps to | Example |
|----------|---------|---------|
| `{{1}}` | Currency code | `OMR` |
| `{{2}}` | Amount | `12.500` |
| `{{3}}` | Order number | `ORD-2026-00123` |

---

## Template 4 — Payment Reminder

| Field | Value |
|-------|-------|
| **Template name** | `cmx_payment_reminder` |
| **Category** | UTILITY |
| **Language** | English (en) |

**Body (EN):**
```
Friendly reminder: Your payment of {{1}} {{2}} for order #{{3}} is due.

Please pay at the branch or contact us to arrange payment.
```

**Arabic (ar) body:**
```
تذكير: دفعتك البالغة {{1}} {{2}} للطلب رقم #{{3}} مستحقة الآن.

يرجى الدفع في الفرع أو التواصل معنا لترتيب الدفع.
```

**Variables:**
| Variable | Maps to | Example |
|----------|---------|---------|
| `{{1}}` | Currency code | `OMR` |
| `{{2}}` | Amount | `12.500` |
| `{{3}}` | Order number | `ORD-2026-00123` |

---

## Template 5 — Order Delayed

| Field | Value |
|-------|-------|
| **Template name** | `cmx_order_delayed` |
| **Category** | UTILITY |
| **Language** | English (en) |

**Body (EN):**
```
Update on your order #{{1}}: There is a delay.

New estimated ready time: {{2}}

We apologize for the inconvenience.
```

**Arabic (ar) body:**
```
تحديث بشأن طلبك رقم #{{1}}: هناك تأخير.

الموعد الجديد المتوقع للجهوزية: {{2}}

نعتذر عن الإزعاج.
```

**Variables:**
| Variable | Maps to | Example |
|----------|---------|---------|
| `{{1}}` | Order number | `ORD-2026-00123` |
| `{{2}}` | New estimated time | `Today by 6:00 PM` |

---

## Submission Checklist

- [ ] `cmx_order_ready` — submitted
- [ ] `cmx_order_cancelled` — submitted
- [ ] `cmx_payment_received` — submitted
- [ ] `cmx_payment_reminder` — submitted
- [ ] `cmx_order_delayed` — submitted

## Approval Tracking

| Template | Submitted date | Status | META Template ID | Twilio Template SID |
|----------|---------------|--------|------------------|---------------------|
| `cmx_order_ready` | | PENDING | | |
| `cmx_order_cancelled` | | PENDING | | |
| `cmx_payment_received` | | PENDING | | |
| `cmx_payment_reminder` | | PENDING | | |
| `cmx_order_delayed` | | PENDING | | |

---

## Approval Timeline

- META approval: 24–72 hours
- Twilio BSP (if routing via Twilio): Twilio also validates the template — add 24 hours

---

## Tips for Faster Approval

1. **Use UTILITY category** (not MARKETING) for order/payment notifications — these are approved faster
2. **Keep bodies concise** — META rejects templates with excessive promotions or links
3. **No URLs** in the body unless necessary — links increase review time
4. **Submit in English first** — add Arabic after EN approval
5. **Variable format must be `{{1}}`, `{{2}}`** — do not use named variables

---

## Until Templates Are Approved

Options while waiting:
1. **Use Twilio BSP** with its sandbox template (`Your {1} code is {2}`) for testing
2. **Disable WhatsApp channel** — other channels still work
3. **Use EMAIL** as the fallback for all events that would have gone to WhatsApp

---

## Adding Arabic Language to an Approved Template

After the EN template is approved:
1. WhatsApp Manager → find the template → **Add Language**
2. Select **Arabic (ar)**
3. Submit the Arabic body
4. Approval for the additional language is usually faster (same-day)
