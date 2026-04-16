# Customer App Specification for CleanMateX

Now we define the **Customer App** properly.

This app is not just a nice extra. It is the customer-facing growth channel of CleanMateX. It handles digital onboarding, booking, tracking, receipts, and communication. Your SRS, feature lists, customer engagement model, and technical stack all make it clear that the customer mobile app is a core product, built in Flutter with bilingual support.   

---

# 1) Customer App purpose

## Main objective

Enable customers to interact with the laundry digitally in a simple, mobile-first way.

## What it must achieve

* allow customer login and account access
* support digital onboarding from stub to full profile
* allow order placement
* allow pickup/delivery scheduling
* show order tracking clearly
* provide receipts and invoice access
* reduce dependence on calls and manual WhatsApp follow-up
* create a retention base for future loyalty, promotions, and marketplace growth

This fits the progressive engagement model and the system goal of moving laundries from manual workflows to digital customer experiences.  

---

# 2) Target users

## Primary users

* Full profile B2C customer
* Stub customer upgrading to app user
* Returning customer with OTP login

## Secondary users later

* B2B employee user
* Family account member
* Marketplace customer

The customer engagement model in your specification already distinguishes Guest, Stub, Full Profile, and B2B flows, which is critical for this app design. 

---

# 3) Customer App guiding principles

## Product principles

* mobile-first
* low friction
* fast onboarding
* track-first visibility
* bilingual EN/AR from day one
* simple booking flow
* digital receipt first
* clear statuses
* minimal cognitive load
* scalable for loyalty and marketplace later

## UX principles

* very few steps to log in
* very clear active order visibility
* obvious next action on home screen
* strong reassurance after booking
* readable timelines and delivery statuses
* zero ERP-style clutter
* customer language and preferences respected

If this app feels complicated, adoption dies immediately.

---

# 4) Customer App MVP scope

## Included in MVP

* splash and app initialization
* language selection
* OTP login
* home dashboard
* active orders list
* order details and tracking timeline
* order history
* new order booking
* address management
* schedule pickup/delivery
* order notes/preferences
* receipts list
* receipt details
* profile and preferences
* help/support entry

## Explicitly out of MVP

* wallet top-up
* loyalty engine
* referrals
* subscriptions
* family accounts
* ratings/reviews
* full marketplace
* AI concierge
* voice ordering
* advanced promotions engine

These features exist in the broader backlog, but they are not the right first slice.

---

# 5) Customer App main modules

## A. App Shell & Initialization

Purpose: start the app correctly and route user to the right place.

### Features

* splash screen
* session restore
* language selection
* maintenance mode
* force update handling later
* deep link handling later
* push notification routing later

---

## B. Authentication & Account Access

Purpose: simple, secure customer entry.

### Features

* login by phone number
* OTP verification
* logout
* session persistence
* account bootstrap from stub profile
* optional biometric quick unlock later

This matches the project’s OTP-based customer model. 

---

## C. Home Dashboard

Purpose: give customer immediate value after login.

### Features

* active orders summary
* quick action buttons
* recent receipt shortcut
* latest status update
* pickup/delivery reminder area
* promotions banner placeholder

Home should be action-oriented, not just decorative.

---

## D. Profile & Preferences

Purpose: let customers manage their core account data.

### Features

* basic profile details
* saved addresses
* laundry preferences
* communication preferences
* language preference
* privacy/consent later
* payment methods later

The customer model already includes preferences and addresses as first-class profile data. 

---

## E. Services & Booking

Purpose: let customer place orders smoothly.

### Features

* service category selection
* service details
* choose pickup or drop-off
* choose address
* choose slot/schedule
* add notes/instructions
* order review
* confirm booking

This aligns with the customer app scope in the SRS and features list. 

---

## F. Orders & Tracking

Purpose: give confidence and reduce support calls.

### Features

* active orders list
* order details
* timeline/status tracking
* promised time visibility
* issue/exception visibility
* order history
* reorder later

Real-time tracking is one of the core product functions repeatedly mentioned in your docs. 

---

## G. Receipts & Financial View

Purpose: provide digital proof and transparency.

### Features

* receipts list
* receipt details
* invoice/PDF viewer if enabled
* payment summary
* payment status

This connects directly with your invoicing and receipt strategy.

---

## H. Notifications & Updates

Purpose: keep customer informed without manual follow-up.

### Features

* order status notifications
* ready for pickup alert
* delivery status alert later
* promotional notifications placeholder
* notification preferences

Push, WhatsApp, and SMS are core channels in the platform requirements.  

---

## I. Help & Support

Purpose: reduce friction and recover trust.

### Features

* FAQ
* contact support
* report issue
* order-related help entry
* policy/help pages

---

# 6) Customer App navigation structure

For MVP, keep navigation very simple.

## Recommended bottom navigation

* Home
* Orders
* Book
* Receipts
* Profile

This is better than overloading the home screen with everything.

---

# 7) Customer App MVP screen list

## Launch / Access

* Splash Screen
* Language Selection Screen
* Welcome / Login Screen
* OTP Verification Screen

## Home

* Home Dashboard Screen

## Booking

* Services Categories Screen
* Service Details Screen
* New Order Screen
* Address Selection Screen
* Add/Edit Address Screen
* Schedule Pickup/Delivery Screen
* Order Notes & Preferences Screen
* Order Review Screen
* Order Confirmation Screen

## Orders

* Active Orders Screen
* Order Details Screen
* Order Tracking Timeline Screen
* Order History Screen

## Receipts

* Receipts List Screen
* Receipt Details Screen
* Invoice/PDF Viewer Screen

## Profile

* Profile Screen
* Edit Profile Screen
* Saved Addresses Screen
* Preferences Screen
* Notification Preferences Screen
* Language Settings Screen

## Help

* Help Center Screen
* FAQ Screen
* Contact Support Screen
* Report Issue Screen

---

# 8) Screen-by-screen purpose

## 8.1 Splash Screen

### Purpose

Initialize app and restore session.

### Actions

* check session
* load language
* route to login or home

---

## 8.2 Language Selection Screen

### Purpose

Choose English or Arabic on first launch.

### Fields

* English
* العربية

### Actions

* save preference
* continue

Because AR/EN and RTL are baseline requirements, this is not optional.  

---

## 8.3 Welcome / Login Screen

### Purpose

Start login using phone number.

### Fields

* phone number
* continue button

### Actions

* request OTP

---

## 8.4 OTP Verification Screen

### Purpose

Verify user and log in.

### Fields

* OTP code
* resend code
* verify button

### Actions

* verify OTP
* create or attach full profile session

This is central to your progressive engagement and upgrade flow. 

---

## 8.5 Home Dashboard Screen

### Purpose

Show immediate customer value.

### Widgets

* active order card(s)
* quick book action
* track current order shortcut
* recent receipt shortcut
* promo placeholder
* support shortcut

### Desired outcome

Customer should understand their current state in under 5 seconds.

---

## 8.6 Services Categories Screen

### Purpose

Start booking by selecting service type.

### Data

* laundry
* ironing
* dry cleaning
* premium care
* other enabled services later

These service groups are core across the backlog and features lists.

---

## 8.7 Service Details Screen

### Purpose

Explain selected service and guide customer forward.

### Data

* service description
* estimated turnaround
* service notes
* pricing summary or “price calculated later” based on policy

---

## 8.8 New Order Screen

### Purpose

Capture booking details.

### Fields

* selected service
* pickup or drop-off
* order notes
* special preferences
* express option if allowed later

### Actions

* continue to address
* continue to schedule

---

## 8.9 Address Selection Screen

### Purpose

Choose where service happens.

### Data

* saved addresses
* add new address option

### Actions

* select address
* create new address

---

## 8.10 Add/Edit Address Screen

### Purpose

Store customer address.

### Fields

* label
* area
* building
* street
* landmark
* notes
* map integration later

---

## 8.11 Schedule Pickup/Delivery Screen

### Purpose

Choose slot and timing.

### Fields

* available date
* available time slot
* pickup or delivery context

### Actions

* confirm slot
* continue

Scheduling and logistics are core customer-facing requirements. 

---

## 8.12 Order Notes & Preferences Screen

### Purpose

Capture instructions.

### Fields

* fold or hang
* fragrance preference
* eco preference
* general notes

These preferences are already part of your customer profile concept. 

---

## 8.13 Order Review Screen

### Purpose

Let customer confirm before submission.

### Data

* selected service
* address
* schedule
* preferences
* pricing summary if known
* receipt/delivery expectation

### Actions

* confirm order
* go back and edit

---

## 8.14 Order Confirmation Screen

### Purpose

Give strong reassurance after booking.

### Data

* order number
* confirmation message
* next step summary
* track order button

---

## 8.15 Active Orders Screen

### Purpose

Show all current live orders.

### Data

* order number
* service type
* current status
* latest update
* expected ready/delivery time

---

## 8.16 Order Details Screen

### Purpose

Show detailed order information.

### Data

* order summary
* service details
* address
* notes
* payment summary
* receipt link if available

---

## 8.17 Order Tracking Timeline Screen

### Purpose

Show status progression clearly.

### Timeline examples

* order placed
* accepted
* preparing/processing
* ready
* out for delivery later
* delivered/collected

This directly reflects the platform’s workflow visibility expectations.  

---

## 8.18 Order History Screen

### Purpose

Show completed and past orders.

### Actions

* open order details
* reorder later

---

## 8.19 Receipts List Screen

### Purpose

Central place for financial/order documents.

### Data

* receipt number
* order number
* date
* amount
* payment status

---

## 8.20 Receipt Details Screen

### Purpose

Show invoice/receipt content.

### Data

* line summary
* totals
* payment state
* download/open PDF if allowed

This is consistent with the in-app receipt strategy.

---

## 8.21 Invoice/PDF Viewer Screen

### Purpose

Open formal invoice document when available.

### Action

* view PDF
* share/download later

PDF is plan-gated and not always available, so the UI should be feature-aware.

---

## 8.22 Profile Screen

### Purpose

Show and manage customer account.

### Data

* name
* phone
* email later
* default preferences
* addresses count

---

## 8.23 Edit Profile Screen

### Purpose

Update customer profile basics.

### Fields

* first name
* last name
* email optional
* avatar later

---

## 8.24 Saved Addresses Screen

### Purpose

Manage reusable locations.

### Actions

* add address
* edit address
* delete address

---

## 8.25 Preferences Screen

### Purpose

Manage laundry preferences.

### Fields

* fold or hang
* fragrance
* eco preference
* default instructions

---

## 8.26 Notification Preferences Screen

### Purpose

Control communication preferences.

### Fields

* push on/off
* SMS fallback later
* WhatsApp preference visibility later

---

## 8.27 Help Center Screen

### Purpose

Central support entry.

### Actions

* open FAQ
* contact support
* report issue

---

## 8.28 Report Issue Screen

### Purpose

Let customer raise a problem.

### Fields

* order reference
* issue type
* note
* attachment later

This ties cleanly into your issue/dispute thinking, even if the full dispute center is later. 

---

# 9) Key user flows

## Flow 1: Existing full-profile login

1. open app
2. enter phone
3. verify OTP
4. land on home
5. see active orders and shortcuts

## Flow 2: Stub customer upgrade

1. receive invite or use app login
2. enter phone
3. verify OTP
4. system matches stub profile
5. account becomes usable in app

This is one of the most important flows in your customer strategy. 

## Flow 3: New order booking

1. open booking
2. choose service
3. choose address
4. choose schedule
5. add notes/preferences
6. review
7. confirm
8. see confirmation

## Flow 4: Track active order

1. open orders
2. choose order
3. view details
4. open timeline
5. see latest status

## Flow 5: View receipt

1. open receipts
2. choose receipt
3. read summary
4. open PDF if available

## Flow 6: Manage profile

1. open profile
2. edit preferences or addresses
3. save
4. use updated defaults in future orders

---

# 10) Backend/API needs for Customer App

## Auth

* request OTP
* verify OTP
* get current session/profile
* logout

## Profile

* get my profile
* update my profile
* list my addresses
* create/update/delete address
* update preferences

## Booking

* list available services/categories
* create order
* list available slots
* calculate booking summary if needed

## Orders

* list active orders
* list order history
* get order details
* get order tracking timeline

## Receipts

* list receipts
* get receipt details
* get invoice/PDF URL if allowed

## Support

* submit issue/help request
* list FAQs or support topics later

These APIs fit directly with the larger platform requirements.  

---

# 11) Data objects Customer App must understand

Use shared models, not app-specific duplicates.

## Core entities

* CustomerProfile
* CustomerAddress
* CustomerPreferences
* ServiceCategory
* BookingRequest
* BookingSummary
* OrderSummary
* OrderDetail
* OrderTimelineEvent
* ReceiptSummary
* ReceiptDetail
* AppNotificationSummary

## Important fields

* customer type / engagement state
* phone
* name
* addresses
* preferences
* current status
* ready_by_at or expected date
* payment status
* receipt channel availability

---

# 12) Non-functional requirements for Customer App

## Performance

* login must feel fast
* home screen should load quickly
* order tracking must be responsive
* receipt access must not feel buried or slow

The broader system target is p50 under 300ms and p95 under 800ms for core APIs. 

## Localization

* EN/AR fully supported
* RTL-safe layouts
* localized dates/currency/text
* no broken Arabic glyph behavior in receipt views

## Security

* OTP-based secure login
* user sees only their own data
* secure session handling
* no leakage across tenants

## Reliability

* clear error states
* retry where safe
* stable session restore
* graceful handling of unavailable services

---

# 13) Recommended Flutter feature structure for Customer App

```text
lib/
  core/
    app/
    config/
    constants/
    errors/
    routing/
    theme/
    widgets/
  features/
    auth/
    home/
    booking/
    orders/
    receipts/
    profile/
    support/
    notifications/
```

## Suggested internal layering per feature

```text
feature/
  data/
    models/
    repositories/
    services/
  domain/
    entities/
    usecases/
  presentation/
    screens/
    widgets/
    controllers/
```

This is the right level of structure without overengineering it.

---

# 14) Final MVP definition for Customer App

## Must-have

* splash
* language selection
* OTP login
* home dashboard
* active orders
* order details
* tracking timeline
* order history
* service selection
* address selection
* scheduling
* order review
* order confirmation
* receipts list/details
* profile
* preferences
* addresses
* help/report issue

## Nice-to-have but not MVP

* wallet
* loyalty
* referrals
* family accounts
* subscriptions
* ratings/reviews
* marketplace browsing
* AI helper
* voice ordering

That is the clean boundary.

---

# 15) Hard recommendation

Build the Customer App in this order:

1. auth + language
2. home + active orders
3. order detail + tracking
4. receipts
5. profile + addresses + preferences
6. booking flow
7. help/report issue

Why this order?

Because customers get immediate value from:

* logging in,
* seeing existing orders,
* tracking status,
* accessing receipts.

Booking can come right after the visibility layer is stable.

---

# 16) Final positioning

The Customer App is your:

* trust layer,
* convenience layer,
* retention layer,
* future marketplace layer.

The Staff App is your execution engine.
The Customer App is your promise to the customer.

That is the correct two-app foundation for CleanMateX.
