
I've created a comprehensive prioritized list of pending features and tasks. Here's a summary:

📊 Summary: Requirements vs Implementation
Status	Count	Percentage
✅ Completed	~6 major features	~22%
🚧 Partial	~4 features	~15%
❌ Not Started	~17 features	~63%
🔴 Priority 1: MVP Blockers (4-6 weeks)
#	Feature	Status	Effort
P1.1	Split-Suborder & Issue-to-Solve	❌ 0%	2 weeks
P1.2	Per-Piece Barcode Scanning	🚧 30%	1 week
P1.3	Scheduling & Slot Management	❌ 0%	2 weeks
P1.4	Frontend Bilingual Completion	🚧 71%	3-5 days
P1.5	Payment Gateway Integration	🚧 Structure exists	1 week
🟠 Priority 2: Core Operations (4-6 weeks)
Vouchers & Promotional Codes
Refunds & Credit Notes
B2B Statements
Notification Storage
Assembly Location Management
🟡 Priority 3-8: Post-MVP Features
P3: Customer Engagement (Loyalty, Memberships, Wallet, Campaigns)
P4: Mobile Apps (Customer, Driver, Store)
P5: Marketplace & Reviews
P6: Operations (Inventory, Suppliers, Machines)
P7: Analytics & AI
P8: Integrations (SMS, Email, Accounting)
Total Timeline: ~14-18 months for full implementation

The full detailed plan with all tasks is in the plan file. Would you like me to proceed with this prioritized list, or do you have specific areas you want to focus on first?

Claude’s Plan
CleanMateX - Pending Features/Tasks Priority List
Generated: 2026-01-14
Based on: Requirements Specifications vs Current Implementation Analysis

EXECUTIVE SUMMARY
Category	Requirements	Implemented	Gap
Overall	27 major features	~6 complete	~78% pending
API Endpoints	65+ needed	80 implemented	✅ Good coverage
Database Tables	83+ needed	45+ implemented	~45% missing
Frontend Components	100% bilingual	71% translated	29% pending
🔴 PRIORITY 1: MVP BLOCKERS (Must Complete for Production)
P1.1 ❌ Split-Suborder & Issue-to-Solve
Status: 0% Complete | Effort: 2 weeks

 Order splitting with parent-child linking
 Create org_iss_issues_mst table
 Issue creation workflow (pre/post delivery)
 Issue resolution and re-process routing
 Issue types catalog (sys_issue_type_cd)
P1.2 ❌ Per-Piece Barcode Scanning
Status: 30% (table exists, no scanning logic) | Effort: 1 week

 Barcode scanner integration (camera/hardware)
 Scan verification at each workflow stage
 Scan enforcement policies per tenant
 Piece-level status tracking via scan
 Missing/wrong piece exception flow
P1.3 ❌ Scheduling & Slot Management
Status: 0% Complete | Effort: 2 weeks

 Create org_scd_schedule_slots_mst table
 Recurring schedule configuration
 Capacity calendar per branch
 Reschedule/cancel policies
 Slot booking UI in order creation
P1.4 🚧 Frontend Bilingual Completion
Status: 71% Complete | Effort: 3-5 days

 Translate remaining 43 components
 Processing workflow (11 files)
 Preparation components (6 files)
 Settings pages (15+ files)
 RTL layout verification for all screens
P1.5 🚧 Payment Gateway Integration
Status: Service exists, not wired | Effort: 1 week

 Connect PaymentService to order creation
 Implement HyperPay gateway (GCC)
 Implement PayTabs gateway (GCC)
 Implement Stripe (global fallback)
 Payment status tracking in orders
🟠 PRIORITY 2: CORE OPERATIONS (Enhance MVP)
P2.1 ❌ Vouchers & Promotional Codes
Status: 0% Complete | Effort: 1 week

 Create org_mkt_vouchers_mst table
 Create org_mkt_voucher_usage_tr table
 Voucher validation in order flow
 Discount application logic
 Voucher management UI
P2.2 ❌ Refunds & Credit Notes
Status: 0% Complete (payments table exists) | Effort: 1 week

 Refund workflow with approval
 Credit note generation
 Reversal document creation
 Audit trail for refunds
 Refund management UI
P2.3 ❌ B2B Statements & Invoicing
Status: 0% Complete | Effort: 2 weeks

 Create org_acc_b2b_statements_mst table
 Consolidated monthly statements
 Credit control per corporate customer
 Dunning workflow
 Statement PDF generation
P2.4 ❌ Notification Storage & History
Status: Types defined, no storage | Effort: 1 week

 Create org_ntf_notifications_mst table
 Track all sent notifications
 Delivery status tracking
 Notification preferences per customer
 Notification history UI
P2.5 ❌ Assembly Location Management
Status: Assembly exists, no locations | Effort: 1 week

 Create org_asm_assembly_locations_mst table
 Create org_asm_location_capacity_cf table
 Location-based storage bins
 Capacity tracking per location
 Location assignment in assembly
🟡 PRIORITY 3: CUSTOMER ENGAGEMENT (Post-MVP Phase 2)
P3.1 ❌ Loyalty Programs
Status: 0% Complete | Effort: 3 weeks

 Create org_loy_programs_mst table
 Create org_loy_points_tr table
 Points earning rules
 Points redemption flow
 Tier progression logic
 Loyalty dashboard for customers
P3.2 ❌ Membership Subscriptions
Status: 0% Complete | Effort: 2 weeks

 Create org_sub_memberships_mst table
 Create org_sub_member_benefits_cf table
 Membership plan management
 Auto-renewal handling
 Proration logic
 Membership benefits application
P3.3 ❌ Customer Wallet System
Status: 0% Complete | Effort: 2 weeks

 Create org_wlt_wallets_mst table
 Create org_wlt_transactions_tr table
 Wallet top-up flow
 Wallet payment in orders
 Transaction history
 Balance alerts
P3.4 ❌ Family Accounts
Status: 0% Complete | Effort: 2 weeks

 Create org_fam_family_links_mst table
 Shared wallet support
 Spending limits per member
 Approval workflows for minors
 Family management UI
P3.5 ❌ Campaign Manager
Status: 0% Complete | Effort: 3 weeks

 Create org_cmp_campaigns_mst table
 Create org_cmp_campaign_segments_dtl table
 Customer segmentation
 A/B testing support
 Campaign performance tracking
 Campaign creation UI
🔵 PRIORITY 4: MOBILE APPS (Phase 3)
P4.1 ❌ Customer Mobile App (Flutter)
Status: 0% Complete | Effort: 8 weeks

 Project scaffolding with Riverpod
 Authentication flow
 Order creation & tracking
 Order history
 Payment integration
 Push notifications (FCM)
 Profile management
 Loyalty/wallet integration
P4.2 ❌ Driver Mobile App (Flutter)
Status: 0% Complete | Effort: 6 weeks

 Project scaffolding
 Route management
 Pickup/delivery workflow
 OTP verification interface
 POD capture (signature/photo)
 Offline mode support
 GPS tracking integration
P4.3 ❌ Store Staff App (Flutter)
Status: 0% Complete | Effort: 4 weeks

 Quick order intake
 Barcode scanning
 Order status updates
 Customer lookup
 Basic reporting
🟣 PRIORITY 5: MARKETPLACE & REVIEWS (Phase 4)
P5.1 ❌ Marketplace Listings
Status: 0% Complete | Effort: 4 weeks

 Create org_mkt_listings_mst table
 Tenant storefront pages
 Service catalog display
 Photos & branding per tenant
 Search & discovery
P5.2 ❌ Commission & Escrow System
Status: 0% Complete | Effort: 2 weeks

 Create org_mkt_commissions_tr table
 Commission calculation per order
 Escrow account management
 Payout processing
 Commission reporting
P5.3 ❌ Dynamic Slot Pricing
Status: 0% Complete | Effort: 1 week

 Express/urgent premium pricing
 Peak hour pricing rules
 Demand-based adjustments
 Pricing configuration UI
P5.4 ❌ Customer Reviews & Ratings
Status: 0% Complete | Effort: 2 weeks

 Create org_cxr_reviews_mst table
 Review submission flow
 Moderation queue
 Rating aggregation
 Review display on listings
P5.5 ❌ Dispute Resolution Center
Status: 0% Complete | Effort: 3 weeks

 Create org_dsp_disputes_mst table
 Create org_dsp_dispute_items_dtl table
 Dispute categories
 Evidence upload
 SLA tracking
 Resolution outcomes (refund/voucher/re-process)
 Dispute management UI
⚪ PRIORITY 6: OPERATIONS & INVENTORY (Phase 5)
P6.1 ❌ Inventory Management
Status: 0% Complete | Effort: 3 weeks

 Create org_inv_inventory_items_mst table
 Create org_inv_stock_levels_dtl table
 Consumables tracking
 Stock level alerts
 Re-order suggestions
 Inventory dashboard
P6.2 ❌ Supplier Portal
Status: 0% Complete | Effort: 3 weeks

 Create org_sup_suppliers_mst table
 Create org_sup_purchase_orders_mst table
 Purchase order creation
 Supplier delivery tracking
 Invoice upload
 Supplier management UI
P6.3 ❌ Machine Management
Status: 0% Complete | Effort: 2 weeks

 Create org_mch_machines_mst table
 Create org_mch_maintenance_logs_tr table
 Usage counter tracking
 Maintenance reminders
 Downtime analytics
 Machine dashboard
⚫ PRIORITY 7: ANALYTICS & AI (Phase 6+)
P7.1 ❌ Advanced Analytics
Status: 10% (basic dashboard exists) | Effort: 4 weeks

 Create org_rpt_analytics_daily_mst table
 Revenue heatmap by time/location
 SLA compliance dashboards
 Cohort analysis
 Benchmarking metrics
 Data export capabilities
P7.2 ❌ Sustainability Metrics
Status: 0% Complete | Effort: 2 weeks

 Create org_sus_sustainability_metrics_tr table
 Water/energy estimates
 Eco badges for customers
 Sustainability reporting
 Green packaging options
P7.3 ❌ AI Features (Optional)
Status: 0% Complete | Effort: 8+ weeks

 Pricing estimator ML model
 Vision-based QA (image quality)
 Route optimization AI
 Predictive maintenance
 Churn/loyalty prediction
⬛ PRIORITY 8: INTEGRATIONS (Ongoing)
P8.1 🚧 SMS Integration (Twilio)
Status: Config ready, not implemented | Effort: 3 days

 SMS sending service
 SMS template management
 Fallback from WhatsApp
P8.2 🚧 Email Integration (SendGrid)
Status: Config ready, not implemented | Effort: 3 days

 Email sending service
 Email template management
 Receipt email delivery
P8.3 ❌ Accounting Sync
Status: 0% Complete | Effort: 2 weeks

 Create org_acc_accounting_exports_tr table
 CSV export to accounting
 Chart of accounts mapping
 API integration option
P8.4 ❌ Advanced Maps/Geofencing
Status: 0% Complete | Effort: 2 weeks

 Create org_geo_geofences_mst table
 Google Maps deep integration
 Geofence-based notifications
 Advanced ETA calculation
IMPLEMENTATION TIMELINE ESTIMATE
Phase	Features	Duration	Team Size
MVP Completion	P1.1-P1.5	4-6 weeks	2-3 devs
Core Operations	P2.1-P2.5	4-6 weeks	2-3 devs
Customer Engagement	P3.1-P3.5	8-10 weeks	3-4 devs
Mobile Apps	P4.1-P4.3	12-14 weeks	3-4 devs
Marketplace	P5.1-P5.5	8-10 weeks	3-4 devs
Operations	P6.1-P6.3	6-8 weeks	2-3 devs
Analytics/AI	P7.1-P7.3	8-12 weeks	2-3 devs
Integrations	P8.1-P8.4	4-6 weeks	1-2 devs
Total Estimated Timeline: 55-72 weeks (~14-18 months)

QUICK REFERENCE: WHAT'S DONE vs PENDING
✅ COMPLETED
Multi-tenant database with RLS
Order CRUD & workflow (14 states)
Customer management with profiles
Assembly & QA workflow
Preparation workflow
Delivery routes & OTP
Digital receipts (WhatsApp)
RBAC & permissions
Service catalog & pricing
Dashboard widgets (10+ types)
Subscription management
Feature flags
🚧 PARTIAL (Needs Completion)
Frontend bilingual (71% → 100%)
Payment gateway integration
Per-piece scanning logic
Assembly location tracking
❌ NOT STARTED
Split-suborder & issues
Scheduling/slots
Vouchers/promotions
Refunds/credit notes
B2B statements
Loyalty programs
Memberships
Wallet system
Family accounts
Campaigns
Mobile apps (3)
Marketplace
Reviews/ratings
Disputes
Inventory
Suppliers
Machines
Advanced analytics
AI features
NEXT IMMEDIATE ACTIONS
This Week: Complete P1.4 (Frontend Bilingual) - 3-5 days
Next Week: Implement P1.5 (Payment Gateway) - 1 week
Week 3-4: Build P1.1 (Split-Suborder & Issues) - 2 weeks
Week 5: Complete P1.2 (Barcode Scanning) - 1 week
Week 6-7: Build P1.3 (Scheduling) - 2 weeks
MVP Target: 6-7 weeks from now

Stayed in plan mode

==================

🚨 CRITICAL BLOCKERS FOR MVP (Must Complete First)
1. Assembly & QA Workflow (PRD-009) - 3-4 weeks
Status: 0% Complete (BLOCKING PRODUCTION)

❌ Assembly task creation from FINISHING items
❌ Per-piece scanning verification
❌ Exception handling (missing/wrong/damage pieces)
❌ Location/bin management
❌ Final QA pass/fail decisions with photo documentation
❌ Rework loops for failed QA
❌ Quality gates - blocks READY status until 100% complete + QA pass
2. Digital Receipts (PRD-006) - 2 weeks
Status: 10% Complete

🚧 WhatsApp text/image receipts (basic structure only)
❌ In-app receipt viewer
❌ Multi-language receipt templates (EN/AR)
❌ Receipt delivery workflow integration
3. Delivery Management & POD (PRD-013) - 3 weeks
Status: 0% Complete

❌ Route creation and assignment
❌ OTP generation/verification (95%+ adoption target)
❌ Signature capture
❌ Photo POD capture
❌ Driver app integration
❌ Live tracking interface
4. Per-Piece Scanning (FR-TRK-001) - 1 week
Status: 0% Complete

❌ Barcode/QR scanner integration
❌ Scan verification at each workflow stage
❌ Scan enforcement policies
5. Split-Suborder & Issue-to-Solve (PRD-010) - 2 weeks
Status: 0% Complete

❌ Order splitting logic with parent-child linkage
❌ Issue creation workflow (pre/post delivery)
❌ Issue resolution and re-process routing
📋 MAJOR FEATURES PENDING (Post-MVP)
Phase 2: Enhanced Operations (Weeks 13-24)
Service Catalog & Pricing (PRD-008)
❌ Per-piece/kg pricing engine
❌ Discounts, vouchers, gift cards
❌ Tax calculations (GCC VAT)
❌ Promotions engine
Payments & Invoicing (PRD-012)
❌ Multi-tender payments
❌ Advance/partial payments
❌ Refunds with approval workflows
❌ Credit notes
❌ Payment gateway integration (HyperPay, PayTabs, Stripe)
Multi-Branch Support (PRD-014)
❌ Branch-specific workflows
❌ Inter-branch transfers
❌ Branch performance analytics
Reporting & Analytics (PRD-015)
❌ Revenue heatmap by time/location
❌ SLA compliance dashboards
❌ Cohort analysis
❌ Benchmarking metrics
Phase 3: Customer Experience (Weeks 25-34)
Customer Mobile App (PRD-016) - 8 weeks
❌ Order creation
❌ Order tracking
❌ Payment processing
❌ Loyalty program access
❌ Push notifications
Loyalty Program (PRD-017)
❌ Points earning/redemption
❌ Tier progression
❌ Member benefits
❌ Referral programs
WhatsApp Business API (PRD-018)
❌ Two-way messaging
❌ Order updates via WhatsApp
❌ Receipt delivery
❌ Customer service chat
Phase 4: Driver Operations (Weeks 35-42)
Driver Mobile App (PRD-024) - 6 weeks
❌ Route optimization
❌ Pickup/delivery workflows
❌ OTP verification interface
❌ Offline mode support
❌ POD capture (signature/photo)
Phase 5-8: Enterprise & Growth (Weeks 43-78)
B2B Features
❌ Corporate accounts
❌ Monthly statements
❌ Credit control
❌ Consolidated invoicing
❌ Dunning workflows
Marketplace
❌ Tenant storefronts
❌ Commission/escrow system
❌ Dynamic slot pricing
❌ Review/rating system
❌ Dispute resolution center
Marketing & Engagement
❌ Campaign manager with segmentation
❌ A/B testing
❌ Wallet system
❌ Family accounts with shared wallets
❌ Subscription memberships
Inventory & Operations
❌ Consumables tracking
❌ Stock level alerts
❌ Supplier portal
❌ Machine management
❌ Maintenance scheduling
Advanced Analytics
❌ Sustainability metrics (water/energy)
❌ Predictive analytics
❌ Churn prediction
❌ Eco badges
AI Features (Optional)
❌ Pricing estimator
❌ Vision-based QA
❌ Route optimization
❌ Predictive maintenance
📊 REQUIREMENTS COMPLETION SUMMARY
Category	Total	Complete	Partial	Pending	% Done
MVP (Must)	12	4	3	5	33%
P1 (Should)	9	0	1	8	0%
P2 (Could)	6	0	0	6	0%
TOTAL	27	4	4	19	~15%
🎯 RECOMMENDED EXECUTION PRIORITY
Immediate Focus (Next 12 Weeks - MVP Completion)
Week 1-4: Assembly & QA Workflow (CRITICAL - blocks production)
Week 5-6: Digital Receipts (customer communication)
Week 7-9: Delivery Management & POD (95%+ adoption target)
Week 10: Per-Piece Scanning (enables Assembly completeness)
Week 11-12: Split-Suborder & Issue-to-Solve (advanced order management)
Post-MVP (Weeks 13+)
Pricing engine & payments (revenue generation)
Customer mobile app (digital adoption)
WhatsApp integration (communication efficiency)
Driver mobile app (operational efficiency)
📈 KEY METRICS TO TRACK
Metric	Target	Current
Counter speed (intake→receipt)	< 5 min	⏳ Not measured
Assembly incident rate	< 0.5%	⏳ No data
OTP POD adoption	≥ 95%	❌ 0% (not implemented)
Digital receipt share	≥ 80%	🚧 10% (partial)
API availability	≥ 99.9%	⏳ Not deployed
SLA compliance	< 3% breaches	⏳ Not tracked
💡 RECOMMENDATION
Focus on the 5 critical MVP blockers first (12 weeks with a team of 4-6 developers). This will enable production launch with core functionality:

✅ Quick Drop intake

✅ Preparation itemization

🎯 Assembly & QA workflows ← NEXT

🎯 Digital receipts ← NEXT

🎯 Delivery & POD ← NEXT

After MVP, prioritize revenue-generating features (payments, pricing) and digital adoption (mobile apps, WhatsApp).

Would you like me to create a detailed implementation plan for any of these pending features?
