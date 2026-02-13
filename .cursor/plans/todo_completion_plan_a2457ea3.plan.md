---
name: TODO Completion Plan
overview: A comprehensive plan to complete all TODO comments and placeholder code across CleanMateX, with code-before/after, effects, production readiness, and per-item documentation in docs/dev/CompletePendingAndTODOCodes_13022026/.
todos:
  - id: doc-structure
    content: Create docs/dev/CompletePendingAndTODOCodes_13022026/ folder and index
  - id: phase1-quick-drop
    content: Phase 1.1 - Quick Drop tenant context (create-order + quick-drop-form)
  - id: phase1-jwt
    content: Phase 1.2 - JWT Auth Guard verification (cmx-api)
  - id: phase1-webhook
    content: Phase 1.3 - WhatsApp webhook signature verification
  - id: phase2-currency
    content: Phase 2.1 - Tenant currency and settings
  - id: phase2-proxy
    content: Phase 2.2 - Proxy locale from user preferences
  - id: phase2-track-piece
    content: Phase 2.3 - Order service remove trackByPiece override
  - id: phase2-tax
    content: Phase 2.4 - Tax and preparation hardcoded values
  - id: phase2-pricing
    content: Phase 2.5 - Pricing service express flag
  - id: phase2-order-state
    content: Phase 2.6 - Order state discount/tax calculation
  - id: phase3-minio
    content: Phase 3.1 - MinIO integration (upload-photo, qa, pod)
  - id: phase3-qr
    content: Phase 3.2 - QR code generation
  - id: phase4-email
    content: Phase 4.1 - Email service
  - id: phase4-otp
    content: Phase 4.2 - OTP Twilio integration
  - id: phase4-delivery-otp
    content: Phase 4.3 - Delivery OTP
  - id: phase5-dashboard
    content: Phase 5 - Dashboard service and widgets
  - id: phase6-feature-flags
    content: Phase 6 - Feature flags and TopBar navigation
  - id: phase7-modals
    content: Phase 7 - Customer modals, settings, help
  - id: phase8-remaining
    content: Phase 8 - Payment modal, export, piece history, etc.
  - id: update-existing-docs
    content: Update existing docs (RBAC, Dashboard, Auth)
isProject: false
---

# Comprehensive TODO and Incomplete Code Completion Plan

## Documentation Structure

All implementation documentation will be placed in:

```
docs/dev/CompletePendingAndTODOCodes_13022026/
├── README.md                          # Index and overview
├── 01_quick_drop_tenant_context.md
├── 02_jwt_auth_guard.md
├── 03_whatsapp_webhook_signature.md
├── 04_tenant_currency_settings.md
├── 05_proxy_locale.md
├── 06_order_service_track_by_piece.md
├── 07_tax_and_preparation.md
├── 08_pricing_express_flag.md
├── 09_order_state_discount_tax.md
├── 10_minio_integration.md
├── 11_qr_code_generation.md
├── 12_email_service.md
├── 13_otp_twilio.md
├── 14_delivery_otp.md
├── 15_dashboard_service_widgets.md
├── 16_feature_flags_navigation.md
├── 17_customer_modals_settings.md
├── 18_remaining_items.md
├── PRODUCTION_READINESS_CHECKLIST.md
└── EXISTING_DOCS_UPDATES.md
```

Each doc file follows this template:

```markdown
# [Item Title]

## Summary
Brief description of the fix.

## File(s) Affected
- path/to/file.ts

## Issue
What is wrong and why it matters.

## Code Before
\`\`\`typescript
// exact code as-is
\`\`\`

## Code After
\`\`\`typescript
// corrected code
\`\`\`

## Effects and Dependencies
- Breaking changes (if any)
- Environment variables required
- Related files to update

## Testing
How to verify the fix.

## Production Checklist
- [ ] Env vars documented
- [ ] Error handling verified
- [ ] Tenant isolation confirmed
```

---

## Phase 1: Critical Security and Tenant Context

### 1.1 Quick Drop Form - Tenant ID

**Doc file:** `01_quick_drop_tenant_context.md`

**Files:**
- [web-admin/app/actions/orders/create-order.ts](web-admin/app/actions/orders/create-order.ts)
- [web-admin/app/dashboard/orders/components/quick-drop-form.tsx](web-admin/app/dashboard/orders/components/quick-drop-form.tsx)

**Code Before (create-order.ts):**
```typescript
export async function createOrder(
  tenantOrgId: string,
  formData: FormData | Record<string, any>
): Promise<CreateOrderResult> {
  try {
    // ...
    const order = await createOrderDb(tenantOrgId, validation.data);
```

**Code Before (quick-drop-form.tsx):**
```typescript
  // TODO: Get tenant ID from session
  const tenantOrgId = 'demo-tenant-id';
  // ...
  const result = await createOrder(tenantOrgId, formData);
```

**Code After (create-order.ts):**
```typescript
import { withTenantFromSession } from '@/lib/db/tenant-context';

export const createOrder = withTenantFromSession(
  async (tenantId, formData: FormData | Record<string, any>): Promise<CreateOrderResult> => {
    try {
      const rawData = /* ... */;
      const validation = createOrderSchema.safeParse(rawData);
      if (!validation.success) { /* ... */ }
      const order = await createOrderDb(tenantId, validation.data);
      revalidatePath('/dashboard/orders');
      return { success: true, data: order };
    } catch (error) {
      return { success: false, error: /* ... */ };
    }
  }
);
```

**Code After (quick-drop-form.tsx):**
```typescript
  // Tenant resolved server-side via withTenantFromSession
  const result = await createOrder(formData);
```

**Effects:**
- Breaking: Any caller passing `tenantOrgId` must be updated (search for `createOrder(` usages)
- Fixes multi-tenancy violation
- Unauthenticated users get clear error from `withTenantFromSession`

**Callers to update:** Grep `createOrder\(` - ensure all pass only formData.

---

### 1.2 JWT Auth Guard (cmx-api)

**Doc file:** `02_jwt_auth_guard.md`

**File:** [cmx-api/src/common/guards/jwt-auth.guard.ts](cmx-api/src/common/guards/jwt-auth.guard.ts)

**Code Before:**
```typescript
    // TODO: verify JWT with Supabase or JWT_SECRET and decode tenant_org_id, sub, role
    // For now, allow any Bearer token and set placeholder
    try {
      const payload = this.decodeJwtPayload(token);
      request.tenantOrgId = (payload.tenant_org_id ?? payload.tenantOrgId) as string | undefined;
      // ...
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
```

**Code After:**
```typescript
    try {
      const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
      if (!secret) {
        throw new UnauthorizedException('JWT secret not configured');
      }
      const payload = this.verifyAndDecode(token, secret);
      request.tenantOrgId = (payload.tenant_org_id ?? payload.tenantOrgId) as string | undefined;
      request.userId = (payload.sub ?? payload.user_id) as string | undefined;
      request.roles = Array.isArray(payload.role) ? payload.role : payload.role ? [payload.role] : [];
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private verifyAndDecode(token: string, secret: string): Record<string, unknown> {
    const { verify } = require('jsonwebtoken');
    return verify(token, secret, { algorithms: ['HS256'] }) as Record<string, unknown>;
  }
```

**Effects:**
- Requires `SUPABASE_JWT_SECRET` or `JWT_SECRET` env var
- Invalid/expired tokens rejected
- Add `jsonwebtoken` to cmx-api dependencies if not present

---

### 1.3 WhatsApp Webhook Signature Verification

**Doc file:** `03_whatsapp_webhook_signature.md`

**File:** [web-admin/app/api/v1/receipts/webhooks/whatsapp/route.ts](web-admin/app/api/v1/receipts/webhooks/whatsapp/route.ts)

**Code Before:**
```typescript
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // TODO: Implement webhook signature verification
  return true;
}
```

**Code After:**
```typescript
import { createHmac } from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!secret || !signature) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
  return signature.length > 0 && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```
(Add `import { timingSafeEqual } from 'crypto';`)

**Effects:**
- Production-safe: rejects forged webhooks
- `WHATSAPP_WEBHOOK_SECRET` must be set (already used in route)

---

## Phase 2: Core Service Integrations

### 2.1 Tenant Currency and Settings

**Doc file:** `04_tenant_currency_settings.md`

**Files:**
- [web-admin/src/features/orders/hooks/use-tenant-currency.ts](web-admin/src/features/orders/hooks/use-tenant-currency.ts)
- [web-admin/lib/services/tenant-settings.service.ts](web-admin/lib/services/tenant-settings.service.ts)

**use-tenant-currency.ts - Code Before:**
```typescript
    // TODO: Get currency from tenant settings when available
    return { currency: 'USD', loading: false };
```

**Code After:** Call server action or API that uses `TenantSettingsService.getTenantCurrency(tenantId)`.

**tenant-settings.service.ts - Code Before:**
```typescript
    } catch (error) {//just default to USD for now jhTODO: get the default from the database
      return 'USD';
    }
```

**Code After:**
```typescript
    } catch (error) {
      logger.warn('[TenantSettingsService] getTenantCurrency failed, using default', { error, tenantId });
      // Ensure TENANT_CURRENCY default is seeded in org_tenant_settings_cf
      return 'USD';
    }
```

**Effects:** Add proper logging; ensure migration seeds default currency for tenants.

---

### 2.2 Proxy Locale

**Doc file:** `05_proxy_locale.md`

**File:** [web-admin/proxy.ts](web-admin/proxy.ts)

**Code Before:**
```typescript
  const locale = defaultLocale // TODO: Get from user preferences
```

**Code After:**
```typescript
  const localeCookie = request.cookies.get('NEXT_LOCALE')?.value;
  const locale = localeCookie && ['en', 'ar'].includes(localeCookie)
    ? localeCookie
    : (request.headers.get('accept-language')?.startsWith('ar') ? 'ar' : defaultLocale);
```

**Effects:** Respects next-intl cookie and Accept-Language for RTL/locale.

---

### 2.3 Order Service - Remove Testing Override

**Doc file:** `06_order_service_track_by_piece.md`

**File:** [web-admin/lib/services/order-service.ts](web-admin/lib/services/order-service.ts)

**Code Before:**
```typescript
          if (trackByPiece || true) { // TODO: Remove true after testing
```

**Code After:**
```typescript
          if (trackByPiece) {
```

**Effects:** Piece creation now respects `USE_TRACK_BY_PIECE` tenant setting.

---

### 2.4 Tax and Preparation

**Doc file:** `07_tax_and_preparation.md`

** preparation preview route - Code Before:**
```typescript
    const taxRate = 0.05; // TODO: fetch from tenant settings
```

**Code After:**
```typescript
    const tenantSettings = new TenantSettingsService();
    const taxRate = await tenantSettings.getTaxRate(tenantId) ?? 0.05;
```

**Effects:** Add `getTaxRate` to TenantSettingsService if missing; use `TENANT_TAX_RATE` or similar key.

---

### 2.5 Pricing Service Express Flag

**Doc file:** `08_pricing_express_flag.md`

**Code Before:**
```typescript
                    isExpress: false, // TODO: Get from order context
```

**Code After:** Pass `isExpress` from caller (order payload/params). Update pricing service signature to accept `options: { isExpress?: boolean }`.

---

### 2.6 Order State Discount/Tax

**Doc file:** `09_order_state_discount_tax.md`

**File:** [web-admin/app/dashboard/orders/new/hooks/useOrderState.ts](web-admin/app/dashboard/orders/new/hooks/useOrderState.ts)

**Code Before:**
```typescript
    const discount = 0; // TODO: Implement discount logic
    const tax = 0; // TODO: Implement tax logic
```

**Code After:** Integrate with [order-calculation.service.ts](web-admin/lib/services/order-calculation.service.ts) or existing pricing/tax services. Use `calculateOrderTotals` or equivalent.

---

## Phase 3: Storage and Media

### 3.1 MinIO Integration

**Doc file:** `10_minio_integration.md`

**File:** [web-admin/lib/storage/upload-photo.ts](web-admin/lib/storage/upload-photo.ts)

**Code Before:**
```typescript
    // TODO: Upload to MinIO
    const mockUrl = `${process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:9000'}/orders/...`;
    return { success: true, url: mockUrl };
```

**Code After:** Use `minio` package (already in package.json):

```typescript
import { Client } from 'minio';

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
});

const bucket = process.env.MINIO_BUCKET || 'cleanmatex';
const key = `orders/${tenantOrgId}/${orderId}/photos/${filename}`;
await minioClient.putObject(bucket, key, buffer, file.size, { 'Content-Type': file.type });
const url = await minioClient.presignedGetObject(bucket, key, 24 * 60 * 60); // 24h
return { success: true, url };
```

**Effects:** Env vars: `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_USE_SSL`.

---

### 3.2 QR Code Generation

**Doc file:** `11_qr_code_generation.md`

**File:** [web-admin/lib/utils/qr-code-generator.ts](web-admin/lib/utils/qr-code-generator.ts)

**Code Before:**
```typescript
    // TODO: Use qrcode library to generate actual QR code image
    return trackingUrl;
```

**Code After:**
```typescript
    import QRCode from 'qrcode';
    const dataUrl = await QRCode.toDataURL(trackingUrl, { width: 300, margin: 2 });
    return dataUrl;
```

**Effects:** Returns data URL for `<img src={dataUrl} />`; `qrcode` already in package.json.

---

## Phase 4–8: Summary for Doc Files

Each remaining item (4.1 Email, 4.2 OTP, 4.3 Delivery OTP, 5 Dashboard, 6 Feature flags, 7 Modals/settings, 8 Remaining) will have a dedicated doc file with:

- **Code before** (exact snippet)
- **Code after** (full implementation)
- **Effects and dependencies**
- **Env vars**
- **Testing steps**
- **Production checklist**

Key files for Phase 5–8:

| Doc | Key Files |
|-----|-----------|
| 15_dashboard | dashboard.service.ts, all widgets, DashboardContent.tsx |
| 16_feature_flags | RequireFeature.tsx, Widget.tsx, TopBar.tsx |
| 17_customer_modals | customers/[id]/page.tsx, settings pages, help page |
| 18_remaining | payment-modal, price-history-timeline, PieceHistory, assembly-task-modal, workflow-service, etc. |

---

## Production Readiness Checklist

**Doc file:** `PRODUCTION_READINESS_CHECKLIST.md`

- [ ] All env vars documented in `.env.example` or docs
- [ ] No hardcoded secrets
- [ ] Tenant isolation verified on all queries
- [ ] Error handling and logging in place
- [ ] i18n keys added/verified (`npm run check:i18n`)
- [ ] Build passes (`npm run build`)
- [ ] Security: JWT verified, webhooks signed

---

## Existing Docs to Update

**Doc file:** `EXISTING_DOCS_UPDATES.md`

| Doc | Update |
|-----|--------|
| [docs/dev/RBAC_QUICK_REFERENCE.md](docs/dev/RBAC_QUICK_REFERENCE.md) | Add note if RequireFeature now uses real flags |
| [docs/features/Dashboard_Feature/DASHBOARD_CONTINUATION_GUIDE.md](docs/features/Dashboard_Feature/DASHBOARD_CONTINUATION_GUIDE.md) | Update "What Needs To Be Done" after dashboard fixes |
| [docs/security/AUTH_SECURITY_IMPLEMENTATION.md](docs/security/AUTH_SECURITY_IMPLEMENTATION.md) | Document JWT guard and webhook verification |
| [docs/dev/tenant-isolation-best-practices](docs/security/tenant-isolation-best-practices.md) | Add createOrder pattern (server-side tenant) |
| [CLAUDE.md](CLAUDE.md) | Add reference to CompletePendingAndTODOCodes docs |

---

## Execution Order

1. Create `docs/dev/CompletePendingAndTODOCodes_13022026/` folder and `README.md` index
2. Phase 1 (1.1 → 1.3) – implement and write each doc
3. Phase 2 (2.1 → 2.6)
4. Phase 3 (3.1, 3.2)
5. Phase 4–8
6. Update existing docs per EXISTING_DOCS_UPDATES.md
7. Run production checklist
