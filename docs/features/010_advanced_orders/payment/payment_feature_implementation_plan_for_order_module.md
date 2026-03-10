Claude’s Plan
Payment Feature Implementation Plan for Order Module
Overview
Implement complete payment functionality matching the UI screenshots, integrating with existing database schema (schema_06.sql) and order creation workflow.
Database Schema Analysis (from schema_06.sql)
Existing Tables:
org_invoice_mst - Invoice master (subtotal, discount, tax, total, payment_method, paid_amount, status)
org_payments_dtl_tr - Payment transactions (paid_amount, payment_method, gateway, transaction_id, metadata)
sys_payment_method_cd - Payment methods catalog (cash, card, check, invoice, gateways)
sys_payment_type_cd - Payment types (pay in advance, pay on collect, pay on delivery)
org_payments_types_flag_cf - Payment configuration flags
Missing Tables (to create):
Promo codes/discount codes table
Gift card table
Discount rules/campaigns table
Phase 1: Database Layer Enhancement (Priority: HIGH)
1.1 Create Missing Tables
org_promo_codes_mst: Store promo codes with validation rules
Fields: code, discount_type (%, fixed), discount_value, min_order_amount, max_uses, valid_from/to, is_active
org_gift_cards_mst: Gift card tracking
Fields: card_number, balance, original_amount, issued_date, expiry_date, is_active
org_discount_rules_cf: Discount campaign rules
Fields: rule_name, conditions (JSONB), discount_type, discount_value, priority
1.2 Seed Payment Methods Data
Insert into sys_payment_method_cd: Cash, Card, Pay on Collection, Check, Invoice
Add bilingual names (EN/AR) and icons
1.3 Add Indexes
Index on invoice_no, payment_method, status
Index on promo code lookups
Index on gift card numbers
Phase 2: Backend Services Layer (Priority: HIGH)
2.1 Payment Service (web-admin/lib/services/payment-service.ts)
Core Functions:
processPayment(orderId, paymentData) - Main payment processing
validatePaymentMethod(method, orderTotal) - Validate payment method availability
recordTransaction(invoiceId, paymentDetails) - Record in org_payments_dtl_tr
updatePaymentStatus(orderId, status) - Update order payment status
getPaymentHistory(orderId) - Retrieve payment transactions
2.2 Invoice Service (web-admin/lib/services/invoice-service.ts)
Core Functions:
createInvoice(orderData) - Generate invoice from order
calculateInvoiceTotal(items, discounts, tax) - Calculate totals
applyDiscount(invoice, discountData) - Apply discount to invoice
getInvoice(invoiceId) - Retrieve invoice details
updateInvoiceStatus(invoiceId, status) - Update invoice status
2.3 Discount Service (web-admin/lib/services/discount-service.ts)
Core Functions:
validatePromoCode(code, tenantId, orderTotal) - Validate promo code
applyPromoCode(orderId, promoCode) - Apply promo discount
calculateDiscount(orderTotal, discountRule) - Calculate discount amount
checkPromoCodeUsage(code, customerId) - Check usage limits
2.4 Gift Card Service (web-admin/lib/services/gift-card-service.ts)
Core Functions:
validateGiftCard(cardNumber) - Check card validity and balance
applyGiftCard(orderId, cardNumber, amount) - Apply gift card to order
deductBalance(cardNumber, amount) - Deduct from card balance
getCardBalance(cardNumber) - Get current balance
Phase 3: API Routes / Server Actions (Priority: HIGH)
3.1 Payment Actions (web-admin/app/actions/payments/)
process-payment.ts - Process payment for order
get-payment-methods.ts - Fetch available payment methods
validate-payment.ts - Validate payment data before processing
3.2 Invoice Actions (web-admin/app/actions/invoices/)
create-invoice.ts - Create invoice from order
get-invoice.ts - Retrieve invoice details
update-invoice-status.ts - Update invoice status
3.3 Discount Actions (web-admin/app/actions/discounts/)
validate-promo-code.ts - Validate promo code
apply-discount.ts - Apply discount to order
validate-gift-card.ts - Validate gift card
Phase 4: Frontend Components (Priority: HIGH)
4.1 Enhanced Payment Modal (web-admin/app/dashboard/orders/new/components/payment-modal.tsx)
Existing features to keep:
Payment method selection (Cash, Card, Pay on Collection, Check, Invoice)
Discount percentage/amount toggle
Total calculation with discount preview
New features to add:
Promo Code Section:
Input field for promo code
"Apply" button with validation
Success/error messages
Display applied promo details
Gift Card Section:
Input field for gift card number
"Apply" button with validation
Display card balance
Show applied gift card amount
Check Number Input:
Conditional field when "Check" is selected
Validation for check number format
Payment Summary:
Subtotal
Discount (from promo/manual)
Gift card applied
Tax calculation
Final total
"Pay All Orders" Toggle:
Toggle to pay for multiple orders at once
Display affected order list
4.2 Payment Confirmation Component (NEW)
Location: web-admin/app/dashboard/orders/new/components/payment-confirmation.tsx
Display payment success/failure
Show transaction ID
Print receipt option
Return to orders button
4.3 Invoice Preview Component (NEW)
Location: web-admin/app/dashboard/orders/components/invoice-preview.tsx
Display invoice details
Show payment breakdown
Print invoice option
Download PDF option
Phase 5: State Management & Validation (Priority: MEDIUM)
5.1 Payment State Types (web-admin/lib/types/payment.ts)
interface PaymentData {
  paymentMethod: PaymentMethodCode;
  checkNumber?: string;
  discountType: 'percentage' | 'amount';
  discountValue: number;
  promoCode?: string;
  giftCardNumber?: string;
  giftCardAmount?: number;
  payAllOrders: boolean;
}

interface PaymentValidation {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

interface InvoiceData {
  subtotal: number;
  discount: number;
  giftCardApplied: number;
  tax: number;
  total: number;
}
5.2 Validation Rules
Minimum order amount for certain payment methods
Promo code validation (dates, usage limits, min amount)
Gift card balance validation
Check number format validation
Phase 6: Integration with Order Creation (Priority: HIGH)
6.1 Update Order Creation Flow
File: web-admin/app/actions/orders/create-order.ts Enhanced flow:
Create order (existing)
Create invoice with totals
Apply discounts (promo/manual/gift card)
Process payment if method requires immediate processing
Record payment transaction
Update order payment_status
Return confirmation with invoice ID
6.2 Transaction Handling
Use database transactions for order + invoice + payment
Rollback on payment failure
Log all payment attempts
Phase 7: Payment Gateway Integration (Priority: MEDIUM - Phase 2)
7.1 Gateway Services (Future Enhancement)
hyperpay-service.ts - HyperPay integration
paytabs-service.ts - PayTabs integration
stripe-service.ts - Stripe integration
7.2 Webhook Handlers
Payment success/failure callbacks
Transaction status updates
Reconciliation logic
Phase 8: UI/UX Enhancements (Priority: MEDIUM)
8.1 Bilingual Support
Add payment-related translation keys to new_order_en.json and new_order_ar.json
RTL support for payment modal
Currency formatting (OMR with 3 decimals)
8.2 Loading States
Show loading during payment processing
Disable submit during validation
Progress indicators for multi-step payments
8.3 Error Handling
Display user-friendly error messages
Validation errors inline
Gateway error translations
Phase 9: Testing Strategy (Priority: MEDIUM)
9.1 Unit Tests
Payment calculation logic
Discount validation
Gift card balance checks
Promo code validation
9.2 Integration Tests
Order creation with payment
Invoice generation
Payment transaction recording
Multi-tenant isolation
9.3 E2E Tests
Complete order flow with payment
Promo code application
Gift card redemption
Payment method switching
Phase 10: Documentation (Priority: LOW)
10.1 Developer Documentation
Payment flow diagrams
API documentation
Database schema documentation
Integration guides
10.2 User Documentation
Payment method usage guides
Promo code instructions
Gift card redemption steps
Troubleshooting guide
Implementation Priority Order
Week 1-2: Core Payment Foundation
Create missing database tables (promo codes, gift cards)
Seed payment methods data
Build payment service core functions
Build invoice service core functions
Week 3-4: Backend Integration 5. Create server actions for payments 6. Create server actions for invoices 7. Integrate with existing order creation flow 8. Add transaction handling Week 5-6: Frontend Enhancement 9. Enhance payment modal UI (match screenshots) 10. Add promo code validation UI 11. Add gift card redemption UI 12. Add payment confirmation component Week 7-8: Polish & Testing 13. Add bilingual translations 14. Implement error handling 15. Write unit tests 16. Write integration tests 17. Conduct E2E testing
Key Technical Decisions
Discount Storage: Store both raw discount value and final calculated amount in invoice
Payment Status: Track at both order and invoice levels for flexibility
Gateway Integration: Abstract gateway logic behind interface for easy switching
Transaction Safety: Use PostgreSQL transactions for order+invoice+payment atomicity
Multi-Tenancy: All payment data filtered by tenant_org_id (existing pattern)
Success Criteria
✅ Payment modal matches all 4 UI screenshots exactly
✅ All payment methods working (Cash, Card, Pay on Collection, Check, Invoice)
✅ Promo code validation and application working
✅ Gift card redemption working
✅ Invoice creation and storage working
✅ Payment transaction recording working
✅ Multi-tenant isolation maintained
✅ Bilingual support (EN/AR) complete
✅ All tests passing (unit + integration + E2E)
User approved the plan
Excellent! The plan has been approved. Let me start by creating a comprehensive todo list to track the implementation progress.
Update Todos

Create database migration for promo codes table (org_promo_codes_mst)

Create database migration for gift cards table (org_gift_cards_mst)

Create database migration for discount rules table (org_discount_rules_cf)

Seed payment methods data into sys_payment_method_cd

Create payment service (web-admin/lib/services/payment-service.ts)

Create invoice service (web-admin/lib/services/invoice-service.ts)

Create discount service (web-admin/lib/services/discount-service.ts)

Create gift card service (web-admin/lib/services/gift-card-service.ts)

Create payment TypeScript types (web-admin/lib/types/payment.ts)

Create server actions for payment processing

Create server actions for invoice management

Create server actions for discount/promo validation

Enhance payment modal UI to match screenshots (promo code section)

Enhance payment modal UI to match screenshots (gift card section)

Enhance payment modal UI to match screenshots (check number field)

Add bilingual translations for payment UI (en.json and ar.json)

Integrate payment flow with order creation action

Create payment confirmation component

Write unit tests for payment services

Write integration tests for payment flow
Perfect! Now let me start with Phase 1: Database Layer Enhancement. I'll begin by creating the database migration for the missing payment-related tables.
