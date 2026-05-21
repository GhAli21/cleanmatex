# CleanMateX Full AR Invoice — API Contracts

## Base Path

```text
/api/v1/ar
```

## Invoice APIs

```http
GET    /api/v1/ar/invoices
POST   /api/v1/ar/invoices
GET    /api/v1/ar/invoices/{invoiceId}
PATCH  /api/v1/ar/invoices/{invoiceId}
POST   /api/v1/ar/invoices/{invoiceId}/issue
POST   /api/v1/ar/invoices/{invoiceId}/void
POST   /api/v1/ar/invoices/{invoiceId}/cancel
```

## Create Invoice from Order

```http
POST /api/v1/ar/invoices/from-order
```

Request:

```json
{
  "orderId": "uuid",
  "allocationPolicy": "REMAINING_ONLY",
  "issueNow": true,
  "dueDate": "2026-06-20",
  "paymentTerms": "NET_30",
  "idempotencyKey": "string"
}
```

## Create Invoice from Multiple Orders

```http
POST /api/v1/ar/invoices/from-orders
```

Request:

```json
{
  "customerId": "uuid",
  "orderIds": ["uuid-1", "uuid-2"],
  "allocationPolicy": "REMAINING_ONLY",
  "lineMode": "ORDER_SUMMARY",
  "issueNow": true,
  "dueDate": "2026-06-20",
  "idempotencyKey": "string"
}
```

## Invoice Lines APIs

```http
POST   /api/v1/ar/invoices/{invoiceId}/lines
PATCH  /api/v1/ar/invoices/{invoiceId}/lines/{lineId}
DELETE /api/v1/ar/invoices/{invoiceId}/lines/{lineId}
```

## Invoice Payments APIs

```http
POST /api/v1/ar/invoices/{invoiceId}/payments/allocate-voucher-line
POST /api/v1/ar/invoices/{invoiceId}/payments/manual
POST /api/v1/ar/invoices/{invoiceId}/payments/{paymentId}/reverse
```

## Adjustments APIs

```http
POST /api/v1/ar/invoices/{invoiceId}/adjustments
```

## Credit/Debit Note APIs

```http
POST /api/v1/ar/credit-memos
POST /api/v1/ar/debit-notes
```

## Customer AR APIs

```http
GET /api/v1/ar/customers/{customerId}/balance
GET /api/v1/ar/customers/{customerId}/ledger
```

## Reporting APIs

```http
GET /api/v1/ar/reports/aging
GET /api/v1/ar/reports/overdue
GET /api/v1/ar/reports/invoice-payments
GET /api/v1/ar/reports/customer-statements
GET /api/v1/ar/reports/ar-ledger
```

## Error Codes

```text
INVOICE_NOT_FOUND
INVOICE_INVALID_STATUS
INVOICE_ALREADY_PAID
INVOICE_OVERPAYMENT_NOT_ALLOWED
INVOICE_ORDER_ALREADY_INVOICED
INVOICE_CURRENCY_MISMATCH
INVOICE_CUSTOMER_MISMATCH
VOUCHER_LINE_INVALID_FOR_INVOICE_PAYMENT
AR_PERMISSION_DENIED
AR_WRITE_OFF_REASON_REQUIRED
```
