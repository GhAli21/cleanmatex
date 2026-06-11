# API Contracts — Customer Receipt Allocation

## 1. Preview Auto Allocation

```http
POST /api/customer-receipts/allocation/preview-auto
```

Request:

```json
{
  "tenantOrgId": "uuid",
  "branchId": "uuid",
  "customerId": "uuid",
  "sourceType": "ORDER_PAYMENT_MODAL",
  "sourceOrderId": "uuid",
  "receiptAmount": "100.000",
  "currentOrderAllocationAmount": "10.000",
  "excessAmount": "90.000",
  "currencyCode": "OMR",
  "paymentMethodCode": "CASH",
  "policyCode": "DEFAULT_OLDEST_DUE",
  "idempotencyKey": "optional-key"
}
```

Response:

```json
{
  "previewId": "uuid",
  "policy": {
    "policyCode": "DEFAULT_OLDEST_DUE",
    "allocationMode": "AUTO_OLDEST_DUE",
    "fallbackDestination": "CUSTOMER_ADVANCE"
  },
  "receiptAmount": "100.000",
  "currentOrderAllocationAmount": "10.000",
  "excessAmount": "90.000",
  "allocations": [
    {
      "lineRole": "INVOICE_PAYMENT",
      "targetType": "AR_INVOICE",
      "targetId": "uuid",
      "documentNo": "ARI-00001",
      "dueDate": "2026-06-01",
      "outstandingAmount": "25.000",
      "allocationAmount": "25.000",
      "isPartial": false
    },
    {
      "lineRole": "STATEMENT_PAYMENT",
      "targetType": "B2B_STATEMENT",
      "targetId": "uuid",
      "documentNo": "STMT-00001",
      "outstandingAmount": "50.000",
      "allocationAmount": "25.000",
      "isPartial": true
    }
  ],
  "fallbackAllocation": null,
  "remainingUnallocatedAmount": "0.000",
  "warnings": []
}
```

## 2. Preview Manual Allocation

```http
POST /api/customer-receipts/allocation/preview-manual
```

Request:

```json
{
  "tenantOrgId": "uuid",
  "branchId": "uuid",
  "customerId": "uuid",
  "sourceOrderId": "uuid",
  "receiptAmount": "100.000",
  "currencyCode": "OMR",
  "allocations": [
    { "lineRole": "ORDER_PAYMENT", "targetType": "ORDER", "targetId": "uuid", "amount": "10.000" },
    { "lineRole": "INVOICE_PAYMENT", "targetType": "AR_INVOICE", "targetId": "uuid", "amount": "25.000" },
    { "lineRole": "WALLET_TOPUP", "targetType": "WALLET_TOPUP", "targetId": "uuid", "amount": "65.000" }
  ],
  "idempotencyKey": "optional-key"
}
```

## 3. Confirm and Post Allocation

```http
POST /api/customer-receipts/allocation/post
```

Request:

```json
{
  "previewId": "uuid",
  "tenantOrgId": "uuid",
  "branchId": "uuid",
  "customerId": "uuid",
  "sourceOrderId": "uuid",
  "paymentMethodCode": "CASH",
  "cashDrawerSessionId": "uuid",
  "cashTenderedAmount": "100.000",
  "changeReturnedAmount": "0.000",
  "retainedAmount": "100.000",
  "currencyCode": "OMR",
  "allocations": [
    { "lineRole": "ORDER_PAYMENT", "targetType": "ORDER", "targetId": "uuid", "amount": "10.000" },
    { "lineRole": "INVOICE_PAYMENT", "targetType": "AR_INVOICE", "targetId": "uuid", "amount": "25.000" }
  ],
  "idempotencyKey": "required-key"
}
```

Response:

```json
{
  "voucherId": "uuid",
  "voucherNo": "RV-000100",
  "status": "POSTED",
  "cashDrawerImpact": {
    "cashTendered": "100.000",
    "changeReturned": "0.000",
    "netDrawerIn": "100.000"
  },
  "warnings": []
}
```

## 4. Load Open Balances

```http
GET /api/customers/{customerId}/open-balances
```

Response:

```json
{
  "customerId": "uuid",
  "currencyCode": "OMR",
  "balances": [
    {
      "targetType": "AR_INVOICE",
      "targetId": "uuid",
      "documentNo": "ARI-00001",
      "documentDate": "2026-05-01",
      "dueDate": "2026-05-30",
      "status": "OVERDUE",
      "outstandingAmount": "25.000",
      "lineRole": "INVOICE_PAYMENT"
    }
  ]
}
```
