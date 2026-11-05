# Financial summary — user guide

The **Financial summary** (الملخص المالي) shows an order's money as a statement:
what the order is worth, then how it was settled. Every figure comes from the
system's records; nothing is estimated on screen.

## Reading the statement

**Order value (قيمة الطلب)** builds up to the **Total (الإجمالي)**:

| Line | Meaning |
|---|---|
| Items & extras (الأصناف والإضافات) | The garments' prices. "Extras (included)" and "Express premium (included)" are already inside these prices; they are shown for information and never added again. |
| Charges (الرسوم) | Delivery and other order charges. A voided charge stays visible, struck through, "not counted". |
| Discounts (الخصومات) | Order and line discounts, shown with a minus sign. |
| Tax (الضريبة) | Tax added on top. On tax-inclusive orders it reads "Tax (included in prices)" and is not added. |
| Rounding (التقريب) | Only on older orders that stored a rounding difference. Cash rounding of change happens at payment, not here. |

**Settlement (السداد)** brings the total down to the **balance (الرصيد)**:

| Line | Meaning |
|---|---|
| Payments (المدفوعات) | Money received, one line per payment. Pending or failed payments are shown but "not counted". |
| Credits (الأرصدة المطبّقة) | Wallet, gift card, customer advance or credit note applied to the order. |
| Refunds (المبالغ المستردة) | Money given back. |

The balance always carries a word:

| Word | Meaning |
|---|---|
| Due (مستحق) | The customer still owes this amount. |
| Due at collection (مستحق عند الاستلام) | The order is paid when the customer collects it. |
| Due on invoice (مستحق بالفاتورة) | The amount is billed on the customer's AR invoice. |
| Settled (مسدّد) | Nothing is owed. |
| Overpaid (مدفوع زيادة) | More was received than the total; resolve it (change, wallet, refund). |

## Badges

- **Payment status** (Unpaid, Partially paid, Paid…) and **settlement type** (Pay on collection…).
- **Reconciled (مطابق)** — every figure agrees with its records. **Figures differ (الأرقام مختلفة)** — a check failed; open the warnings. **Recalculating (قيد إعادة الاحتساب)** — the figures are being rebuilt; wait or refresh.

## Detail levels

**Detailed (مفصّل)** shows the main lines; **Full (كامل)** adds records (tax documents, vouchers, order changes, timeline); **Audit (تدقيق)** shows every line and technical details. The choice is remembered for each screen.

## Order Edit card

While editing an order, the card under **Review** shows the **New total (الإجمالي الجديد)**, what it **Was (كان)** with the difference, and the **Balance after change (الرصيد بعد التعديل)**, plus what happens next: To collect, Settled, Refund or credit due. It updates half a second after each change; "Updating…" means new figures are on the way. Notes or dates alone change no money ("No money change").

## Customers

The tracking link and the customer app show a short summary: items, charges, discounts, tax, total, payments by method, credits and the balance. No staff names, references or internal checks are ever shown to customers.
