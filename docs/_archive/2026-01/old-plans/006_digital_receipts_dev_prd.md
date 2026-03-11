# Digital Receipts - WhatsApp & In-App - Implementation Plan

**PRD ID**: 006_digital_receipts_dev_prd
**Phase**: MVP
**Priority**: Must Have
**Estimated Duration**: 1.5 weeks
**Dependencies**: PRD-001 (Auth), PRD-003 (Customer), PRD-004 (Order Intake)

---

## Overview

Implement digital receipt delivery via WhatsApp text messages and in-app receipt viewing. Reduces paper waste, provides instant customer confirmation, and enables QR-based order tracking. Feature-flagged based on subscription plan.

---

## Business Value

- **Cost Savings**: Eliminate thermal paper costs (80%+ digital adoption target)
- **Customer Experience**: Instant receipt delivery via preferred channel
- **Environmental**: Reduce paper waste, support sustainability goals
- **Tracking**: QR code enables easy order lookup
- **Scalability**: WhatsApp text cheaper than SMS, widely used in GCC

---

## Requirements

### Functional Requirements

- **FR-RECEIPT-001**: Generate receipt data (order summary, items, pricing)
- **FR-RECEIPT-002**: Send receipt via WhatsApp text message (feature-flagged)
- **FR-RECEIPT-003**: Send receipt via WhatsApp image (branded - feature-flagged)
- **FR-RECEIPT-004**: In-app receipt view (feature-flagged)
- **FR-RECEIPT-005**: QR code generation for order tracking
- **FR-RECEIPT-006**: Receipt includes: order number, customer, items, total, ready-by date
- **FR-RECEIPT-007**: Bilingual receipt content (EN/AR based on customer preference)
- **FR-RECEIPT-008**: Retry mechanism for failed deliveries (3 attempts)
- **FR-RECEIPT-009**: Receipt delivery status tracking
- **FR-RECEIPT-010**: Resend receipt functionality (admin/customer)
- **FR-RECEIPT-011**: Receipt template customization per tenant (branding)
- **FR-RECEIPT-012**: Fallback: SMS if WhatsApp fails (future)

### Non-Functional Requirements

- **NFR-RECEIPT-001**: Receipt generation time < 2 seconds
- **NFR-RECEIPT-002**: WhatsApp delivery time < 10 seconds (p95)
- **NFR-RECEIPT-003**: Delivery success rate > 95%
- **NFR-RECEIPT-004**: Support 10,000+ receipts/day per tenant
- **NFR-RECEIPT-005**: QR code scannable at 10cm distance
- **NFR-RECEIPT-006**: Receipt data retention: 2 years

---

## Database Schema

```sql
-- Receipt records
CREATE TABLE IF NOT EXISTS org_receipts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  tenant_org_id     UUID NOT NULL,
  customer_id       UUID NOT NULL,
  receipt_type      VARCHAR(20) NOT NULL, -- whatsapp_text, whatsapp_image, in_app, pdf, print
  delivery_channel  VARCHAR(20), -- whatsapp, sms, email, app
  delivery_status   VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed
  sent_at           TIMESTAMP,
  delivered_at      TIMESTAMP,
  failed_at         TIMESTAMP,
  failure_reason    TEXT,
  retry_count       INTEGER DEFAULT 0,
  recipient_phone   VARCHAR(50),
  recipient_email   VARCHAR(255),
  content_text      TEXT, -- Plain text receipt
  content_html      TEXT, -- HTML receipt (future)
  qr_code           TEXT, -- Data URL or image URL
  metadata          JSONB, -- WhatsApp message ID, etc.
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id, tenant_org_id)
    REFERENCES org_customers_mst(customer_id, tenant_org_id)
);

CREATE INDEX idx_receipts_order ON org_receipts(order_id);
CREATE INDEX idx_receipts_tenant ON org_receipts(tenant_org_id, created_at DESC);
CREATE INDEX idx_receipts_status ON org_receipts(delivery_status, created_at);

-- Receipt templates (per tenant customization)
CREATE TABLE IF NOT EXISTS org_receipt_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  template_type     VARCHAR(20) NOT NULL, -- whatsapp_text, whatsapp_image
  language          VARCHAR(5) NOT NULL, -- en, ar
  template_content  TEXT NOT NULL, -- Template with placeholders
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tenant_org_id, template_type, language)
);
```

---

## API Endpoints

### Receipt Generation & Delivery

#### POST /v1/orders/:orderId/receipts
Generate and send receipt.

**Request**:
```json
{
  "types": ["whatsapp_text", "in_app"], // Can send multiple
  "channel": "whatsapp",
  "recipient": "+96890123456", // Override customer phone if needed
  "language": "en" // or "ar"
}
```

**Response** (201):
```json
{
  "receipts": [
    {
      "id": "receipt-uuid-1",
      "type": "whatsapp_text",
      "deliveryChannel": "whatsapp",
      "deliveryStatus": "sent",
      "recipient": "+96890123456",
      "sentAt": "2025-10-10T10:05:00Z",
      "qrCode": "data:image/png;base64,..."
    },
    {
      "id": "receipt-uuid-2",
      "type": "in_app",
      "deliveryStatus": "delivered",
      "sentAt": "2025-10-10T10:05:00Z"
    }
  ]
}
```

#### GET /v1/orders/:orderId/receipts
Get receipts for order.

**Response** (200):
```json
{
  "order": {
    "id": "order-uuid",
    "orderNumber": "ORD-20251010-0001"
  },
  "receipts": [
    {
      "id": "receipt-uuid-1",
      "type": "whatsapp_text",
      "deliveryChannel": "whatsapp",
      "deliveryStatus": "delivered",
      "recipient": "+96890123456",
      "sentAt": "2025-10-10T10:05:00Z",
      "deliveredAt": "2025-10-10T10:05:15Z",
      "retryCount": 0
    }
  ]
}
```

#### POST /v1/receipts/:receiptId/resend
Resend failed receipt.

**Response** (200):
```json
{
  "receipt": {
    "id": "receipt-uuid",
    "deliveryStatus": "sent",
    "sentAt": "2025-10-10T11:00:00Z",
    "retryCount": 1
  }
}
```

#### GET /v1/receipts/:receiptId
Get receipt content (for in-app viewing).

**Response** (200):
```json
{
  "id": "receipt-uuid",
  "order": {
    "orderNumber": "ORD-20251010-0001",
    "receivedAt": "2025-10-10T10:00:00Z",
    "readyBy": "2025-10-11T18:00:00Z",
    "status": "processing"
  },
  "tenant": {
    "name": "Laundry Plus",
    "name2": "لوندري بلس",
    "phone": "+96824123456",
    "logoUrl": "https://storage.../logo.png"
  },
  "customer": {
    "name": "Ahmed Al-Said",
    "phone": "+96890123456"
  },
  "items": [
    {
      "productName": "Shirt (Regular)",
      "productName2": "قميص عادي",
      "quantity": 5,
      "pricePerUnit": 1.500,
      "totalPrice": 7.500
    },
    {
      "productName": "Pants",
      "productName2": "بنطلون",
      "quantity": 3,
      "pricePerUnit": 2.000,
      "totalPrice": 6.000
    }
  ],
  "pricing": {
    "subtotal": 13.500,
    "discount": 0,
    "tax": 0.675,
    "total": 14.175,
    "currency": "OMR"
  },
  "qrCode": "data:image/png;base64,...",
  "trackingUrl": "https://cleanmatex.com/track/ORD-20251010-0001",
  "contentText": "Thank you for choosing Laundry Plus!\n\nOrder: ORD-20251010-0001\nReceived: 10 Oct 2025, 10:00 AM\nReady By: 11 Oct 2025, 6:00 PM\n\nItems:\n- Shirt (Regular) x5: 7.500 OMR\n- Pants x3: 6.000 OMR\n\nSubtotal: 13.500 OMR\nTax (5%): 0.675 OMR\nTotal: 14.175 OMR\n\nTrack your order: https://cleanmatex.com/track/ORD-20251010-0001",
  "createdAt": "2025-10-10T10:05:00Z"
}
```

---

## WhatsApp Integration

### WhatsApp Text Receipt Format

**English**:
```
Thank you for choosing Laundry Plus! 👕

Order: ORD-20251010-0001
Received: 10 Oct 2025, 10:00 AM
Ready By: 11 Oct 2025, 6:00 PM

Items:
• Shirt (Regular) x5: 7.500 OMR
• Pants x3: 6.000 OMR

Subtotal: 13.500 OMR
Tax (5%): 0.675 OMR
━━━━━━━━━━━━━━━━━━
Total: 14.175 OMR

Track your order:
https://cleanmatex.com/track/ORD-20251010-0001

Need help? Reply to this message.
```

**Arabic (RTL)**:
```
شكراً لاختيارك لوندري بلس! 👕

الطلب: ORD-20251010-0001
تاريخ الاستلام: 10 أكتوبر 2025، 10:00 صباحاً
جاهز بحلول: 11 أكتوبر 2025، 6:00 مساءً

العناصر:
• قميص عادي x5: 7.500 ريال عماني
• بنطلون x3: 6.000 ريال عماني

المجموع الفرعي: 13.500 ريال عماني
الضريبة (5%): 0.675 ريال عماني
━━━━━━━━━━━━━━━━━━
الإجمالي: 14.175 ريال عماني

تتبع طلبك:
https://cleanmatex.com/track/ORD-20251010-0001

تحتاج مساعدة؟ قم بالرد على هذه الرسالة.
```

### WhatsApp Business API Integration

```typescript
// WhatsAppService
async sendTextReceipt(phone: string, content: string, qrCodeUrl: string) {
  const message = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: {
      body: content,
      preview_url: true // Enable link preview
    }
  };

  const response = await this.whatsappClient.sendMessage(message);
  return {
    messageId: response.messages[0].id,
    status: 'sent'
  };
}
```

---

## UI/UX Requirements

### Receipt Preview (Admin)
- **Location**: Order detail page → "View Receipt" button
- **Display**: Modal with receipt content
- **Actions**: Send WhatsApp, Send SMS, Download PDF (future), Print
- **Language Toggle**: Switch between EN/AR preview

### Receipt Delivery Status (Order Detail)
- **Widget**: "Receipt Delivery" card
- **Status Indicators**:
  - ✅ Delivered (green)
  - 📤 Sent (blue)
  - ⏳ Pending (yellow)
  - ❌ Failed (red)
- **Actions**: Resend button if failed
- **Details**: Recipient, sent time, delivery time

### In-App Receipt (Mobile App - Customer)
- **Location**: Order detail → "View Receipt" tab
- **Display**: Formatted receipt with tenant branding
- **QR Code**: Scannable for quick access
- **Actions**: Share (screenshot), Download (future)
- **Bilingual**: Auto-detect from customer language preference

### Order Tracking Page (Public)
- **URL**: `https://cleanmatex.com/track/{orderNumber}`
- **Input**: Order number (from QR scan or manual entry)
- **Display**: Order status, ready-by date, items, receipt
- **Updates**: Real-time status (polling every 30s)
- **Bilingual**: EN/AR toggle

---

## Technical Implementation

### Backend Tasks

1. **ReceiptsService**
   - `generate()` - Create receipt content from order
   - `send()` - Send via WhatsApp/SMS/Email
   - `resend()` - Retry failed delivery
   - `getByOrder()` - Get all receipts for order

2. **Template Engine**
   - Load template from `org_receipt_templates`
   - Replace placeholders: `{{orderNumber}}`, `{{customerName}}`, `{{items}}`, etc.
   - Support bilingual templates (EN/AR)

3. **WhatsApp Integration**
   - WhatsApp Business API client
   - Message queue for delivery (BullMQ)
   - Webhook for delivery status updates
   - Retry logic (3 attempts with exponential backoff)

4. **QR Code Generation**
   - Library: `qrcode` (Node.js)
   - Content: Order tracking URL
   - Format: PNG, 300x300px
   - Store as data URL or upload to MinIO

5. **Feature Flag Check**
   - Before sending, check `tenant.feature_flags.whatsapp_receipts`
   - If disabled, return error or fallback to email (future)

### Frontend Tasks (Next.js Admin)

1. **Receipt Preview Component**
   - Render receipt with tenant branding
   - Language switcher (EN/AR)
   - Send/resend buttons

2. **Receipt Delivery Status Widget**
   - Status badge component
   - Retry action with confirmation

### Mobile App Tasks (Flutter)

1. **In-App Receipt View**
   - Fetch receipt via API
   - Render with tenant colors/logo
   - QR code display
   - Share functionality

2. **Order Tracking Screen**
   - QR code scanner
   - Manual order number input
   - Display order status and receipt

### Background Jobs

```typescript
// Receipt delivery queue (BullMQ)
@Processor('receipts')
export class ReceiptProcessor {
  @Process('send-whatsapp')
  async sendWhatsApp(job: Job) {
    const { receiptId } = job.data;
    const receipt = await this.receiptsService.findById(receiptId);

    try {
      await this.whatsappService.sendTextReceipt(
        receipt.recipientPhone,
        receipt.contentText,
        receipt.qrCode
      );

      await this.receiptsService.markDelivered(receiptId);
    } catch (error) {
      if (receipt.retryCount < 3) {
        await this.receiptsService.scheduleRetry(receiptId);
      } else {
        await this.receiptsService.markFailed(receiptId, error.message);
      }
    }
  }
}
```

### Database Migrations

```sql
-- Migration: 0009_receipts_system.sql

CREATE TABLE IF NOT EXISTS org_receipts (
  -- schema as above
);

CREATE TABLE IF NOT EXISTS org_receipt_templates (
  -- schema as above
);

-- Seed default templates for existing tenants
INSERT INTO org_receipt_templates (tenant_org_id, template_type, language, template_content)
SELECT id, 'whatsapp_text', 'en',
'Thank you for choosing {{tenantName}}! 👕

Order: {{orderNumber}}
Received: {{receivedAt}}
Ready By: {{readyBy}}

Items:
{{items}}

Subtotal: {{subtotal}} {{currency}}
Tax ({{taxRate}}%): {{tax}} {{currency}}
━━━━━━━━━━━━━━━━━━
Total: {{total}} {{currency}}

Track your order:
{{trackingUrl}}

Need help? Reply to this message.'
FROM org_tenants_mst;

-- ... Arabic template
```

---

## Acceptance Criteria

- [ ] Receipt generated with order details within 2 seconds
- [ ] WhatsApp text receipt sent within 10 seconds
- [ ] Receipt includes QR code for order tracking
- [ ] Bilingual receipts (EN/AR) based on customer language
- [ ] Delivery status tracked (pending/sent/delivered/failed)
- [ ] Failed receipts retry up to 3 times
- [ ] In-app receipt viewable by customer
- [ ] Order tracking page accessible via QR code
- [ ] Feature flag enforced (whatsapp_receipts must be enabled)
- [ ] Tenant branding (logo, colors) applied to receipts

---

## Testing Requirements

### Unit Tests
- Template rendering with placeholders
- QR code generation
- Retry logic (exponential backoff)

### Integration Tests
- POST /v1/orders/:id/receipts → creates receipt and queues delivery
- GET /v1/receipts/:id → returns receipt content
- Webhook delivery status update

### E2E Tests
- Create order → Complete preparation → Auto-send receipt → Verify WhatsApp delivery
- Failed delivery → Retry 3 times → Mark as failed

---

## Deployment Notes

### Environment Variables

```bash
# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=EAAC...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=my-verify-token
WHATSAPP_WEBHOOK_SECRET=my-webhook-secret

# Receipt Settings
RECEIPT_QR_CODE_SIZE=300
RECEIPT_TRACKING_BASE_URL=https://cleanmatex.com/track
```

### WhatsApp Setup
1. Create Meta Business Account
2. Add WhatsApp Business API
3. Get Phone Number ID and Access Token
4. Set up webhook for delivery status
5. Test message delivery in sandbox

---

## References

- Requirements: Section 3.4 (Finance & Receipts), FR-RCT-001
- Addendum B: Invoicing & Receipt Strategy
- Related PRDs: PRD-004 (Order Intake), PRD-011 (PDF Receipts - P1)

---

**Status**: Ready for Implementation
**Estimated Effort**: 60 hours (1.5 weeks with 2 developers)
