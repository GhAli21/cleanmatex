# Invoicing & Payments - Development Plan & PRD

**Document ID**: 013  
**Version**: 1.0  
**Dependencies**: 001-012  
**Related Requirements**: FR-INV-001, UC09

---

## Overview

Implement invoice generation, multi-tender payments, advance/partial payments, and digital receipt delivery (WhatsApp, SMS, PDF).

## Functional Requirements

### FR-INV-001: Invoice Generation

- Auto-generate at Ready or Delivery
- Line items with pricing
- Taxes, discounts, vouchers
- Payment terms (cash, card, wallet)
- Invoice numbering sequence

### FR-INV-002: Payment Processing

- Multi-tender (split payments)
- Advance payments
- Partial payments
- Payment tracking
- Refunds & credit notes

### FR-INV-003: Receipt Delivery

- **WhatsApp**: Text + branded image with QR
- **SMS**: Link to digital receipt
- **In-App**: PDF download
- **Print**: Thermal or A4
- Plan-based feature flags

## Technical Design

Uses existing:

- `org_invoice_mst`
- `org_payments_dtl_tr`

### Invoice Generation

```typescript
async function generateInvoice(orderId: string): Promise<Invoice> {
  const order = await getOrderWithItems(orderId);

  const invoiceNo = await generateInvoiceNumber(order.tenant_org_id);

  const invoice = await db.insert("org_invoice_mst", {
    order_id: orderId,
    tenant_org_id: order.tenant_org_id,
    invoice_no: invoiceNo,
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    total: order.total,
    status: "pending",
    due_date: new Date(),
  });

  return invoice;
}
```

### Receipt Delivery Channels

```typescript
async function sendReceipt(invoiceId: string, channels: string[]) {
  const invoice = await getInvoice(invoiceId);
  const customer = await getCustomer(invoice.customer_id);

  if (channels.includes("whatsapp") && customer.phone) {
    await sendWhatsAppReceipt(customer.phone, invoice);
  }

  if (channels.includes("sms") && customer.phone) {
    await sendSMSReceipt(customer.phone, invoice);
  }

  if (channels.includes("email") && customer.email) {
    await sendEmailReceipt(customer.email, invoice);
  }
}
```

## API Endpoints

```typescript
POST   /api/v1/invoices                  // Generate invoice
GET    /api/v1/invoices/:id              // Get invoice
POST   /api/v1/invoices/:id/pay          // Record payment
POST   /api/v1/invoices/:id/refund       // Process refund
GET    /api/v1/invoices/:id/receipt      // Get receipt (PDF)
POST   /api/v1/invoices/:id/send         // Send via channels
```

## Implementation (5 days)

1. Invoice generation (2 days)
2. Payment processing (2 days)
3. Receipt templates & delivery (2 days)

## Success Metrics

- Invoice generation: < 2 seconds
- Receipt delivery: < 30 seconds
- Payment accuracy: 100%

## Acceptance Checklist

- [ ] Invoice generation working
- [ ] Multi-tender payments
- [ ] Receipt WhatsApp delivery
- [ ] Receipt SMS delivery
- [ ] PDF generation
- [ ] Refunds functional

---

**Last Updated**: 2025-10-09
