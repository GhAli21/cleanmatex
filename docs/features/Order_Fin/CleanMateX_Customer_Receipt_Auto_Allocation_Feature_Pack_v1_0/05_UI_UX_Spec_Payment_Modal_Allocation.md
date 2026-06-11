# UI/UX Specification — Payment Modal Customer Receipt Allocation

## 1. When to Show

Show **Extra Receipt Handling** when:

```text
settledNow > currentOrderTotal
```

Use label:

```text
Extra Receipt Amount / Unallocated Amount
```

Avoid label:

```text
Change
```

unless the selected action is actual cash returned.

## 2. Required Action Card

```text
Extra Receipt Handling

Extra Amount                 OMR 90.000

Choose action:
[ Return Cash Change ]
[ Reduce Payment Amount ]
[ Manual Allocate to Balances ]
[ Auto Allocate Oldest Balances ]
[ Top up Wallet ]
[ Save as Customer Advance ]
[ Save as Customer Credit ]
```

## 3. Auto Allocation Preview Drawer

```text
Auto Allocation Preview

Policy                       Oldest Due First
Available Extra Amount        OMR 90.000

Will Allocate:
1. ARI-00001                  OMR 25.000
2. ARI-00002                  OMR 40.000
3. STMT-00001                 OMR 25.000 partial

Remaining Extra               OMR 0.000

[Confirm Allocation]
[Change Manually]
[Cancel]
```

If fallback remains:

```text
Remaining Extra               OMR 35.000
Fallback                      Customer Advance

Will Create:
Customer Advance              OMR 35.000
```

## 4. Manual Allocation Drawer

```text
Manual Allocation

Available Extra Amount        OMR 90.000

Open Balances
[ ] ARI-00001                 Outstanding OMR 25.000    Allocate [25.000]
[ ] ARI-00002                 Outstanding OMR 40.000    Allocate [40.000]
[ ] STMT-00001                Outstanding OMR 50.000    Allocate [25.000]
[ ] ORD-00009                 Outstanding OMR 8.000     Allocate [0.000]

Fallback
[ ] Top up Wallet             Amount [0.000]
[ ] Save as Customer Advance  Amount [0.000]
[ ] Save as Customer Credit   Amount [0.000]
[ ] Return Cash Change        Amount [0.000]

Allocated                     OMR 90.000
Unallocated                   OMR 0.000
```

## 5. Payment Modal Summary Additions

### Balance Result

```text
Order Total                  OMR 10.000
Total Settled Now            OMR 100.000
Current Order Allocation      OMR 10.000
Extra Receipt Amount          OMR 90.000
Status                       Extra Receipt Requires Allocation
```

### Allocation Summary

```text
Customer Receipt Allocation

Current Order                OMR 10.000
AR Invoices                  OMR 65.000
B2B Statements               OMR 25.000
Wallet Top-up                OMR 0.000
Customer Advance             OMR 0.000
Unallocated                  OMR 0.000
```

### Posting Preview

```text
Will Create:
- Receipt Voucher RV-000100
- ORDER_PAYMENT current order OMR 10.000
- INVOICE_PAYMENT ARI-00001 OMR 25.000
- INVOICE_PAYMENT ARI-00002 OMR 40.000
- STATEMENT_PAYMENT STMT-00001 OMR 25.000
```

## 6. Submit Button Text

```text
Unresolved excess:
Resolve Extra Receipt — OMR 90.000

Auto allocation selected:
Submit — Allocate Extra OMR 90.000

Fallback advance selected:
Submit — Save Excess as Advance OMR 35.000

Cash change selected:
Submit — Return Change OMR 5.000
```

## 7. UX Rules

```text
1. Show Auto Allocate only when customer is known, not guest.
2. Do not show old balances by default; open drawer on demand.
3. Show preview before posting.
4. Highlight partial last target.
5. Disable submit while unallocated amount > 0.
6. Use “Change Returned” only for cash return.
7. For card/gateway excess, recommend reduce payment or allocate.
8. For B2B, show AR invoices/statements first.
```
