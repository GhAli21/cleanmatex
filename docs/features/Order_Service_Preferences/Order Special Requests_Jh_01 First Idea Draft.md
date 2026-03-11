
Order Special Requests:
--------------------------------

This is a **very important design discussion** for a laundry platform like **CleanMateX**, because **special handling per item/piece** affects:

* Pricing
* Workflow
* Packing
* Delivery
* Quality control

If this is designed wrong, operations become messy very quickly.

Let’s structure it in a **professional, scalable way**.

---

# 1. First Principle: Special Request Scope

Special requests can exist at **3 different levels**:

| Level           | Example                  | Usage                   |
| --------------- | ------------------------ | ----------------------- |
| **Order Level** | "Handle with care"       | Applies to all items    |
| **Item Level**  | "All shirts steam press" | Applies to item group   |
| **Piece Level** | "This dress hang only"   | For individual garments |

Best practice for laundry systems:

**Item Level + Piece Level**

Avoid too many order-level requests because they create confusion.

---

# 2. Typical Laundry Special Requests

You should standardize them in a **catalog table**, not free text.

Example:

| Code          | Name              | Arabic      | Type       |
| ------------- | ----------------- | ----------- | ---------- |
| STEAM_PRESS   | Steam Press       | كوي بالبخار | finishing  |
| HANG          | Hanging           | تعليق       | packing    |
| FOLD          | Folding           | طي          | packing    |
| STARCH_LIGHT  | Light Starch      | نشا خفيف    | processing |
| STARCH_HEAVY  | Heavy Starch      | نشا قوي     | processing |
| PERFUME       | Perfume           | عطر         | finishing  |
| SEPARATE_WASH | Separate Wash     | غسيل منفصل  | washing    |
| DELICATE      | Delicate Handling | عناية خاصة  | washing    |

These should be stored in something like:

```
sys_special_request_cd
```

---

# 3. Database Model (Recommended)

### Catalog Table

```
sys_special_request_cd
```

| column       | description                   |
| ------------ | ----------------------------- |
| request_code | unique code                   |
| name         | English                       |
| name2        | Arabic                        |
| request_type | washing / finishing / packing |
| extra_price  | optional                      |
| is_active    |                               |

---

### Order Item Requests

```
org_order_item_special_requests
```

| column        |
| ------------- |
| id            |
| tenant_org_id |
| order_item_id |
| request_code  |
| extra_price   |
| notes         |

---

### Piece Level Requests (optional)

If **piece tracking enabled**.

```
org_piece_special_requests
```

| column       |
| ------------ |
| piece_id     |
| request_code |

---

# 4. UI Design (Counter Screen)

Example workflow when cashier enters items.

```
Add Item
----------------
Shirt x5

Special Requests:
[ ] Steam Press
[ ] Light Starch
[ ] Hanging
[ ] Folding
```

Optional:

```
Per Piece:
Piece 1 → Hang
Piece 2 → Fold
Piece 3 → Hang
Piece 4 → Hang
Piece 5 → Fold
```

---

# 5. Operational Impact

Special requests should **automatically affect workflow**.

Example:

| Request       | Workflow impact       |
| ------------- | --------------------- |
| Steam Press   | send to press station |
| Starch        | add starch processing |
| Separate Wash | separate batch        |
| Hang          | assembly packing rule |
| Fold          | packing table         |

This aligns with the **configurable workflow system** described in your architecture. 

---

# 6. Pricing Strategy

Two possible models.

### Model A — Free

Special requests are **included**.

Example:

* Steam press → included
* Fold → included

---

### Model B — Extra Charge

Example:

| Request     | Price  |
| ----------- | ------ |
| Steam Press | +0.300 |
| Starch      | +0.200 |
| Perfume     | +0.100 |

Stored in catalog.

---

# 7. Packing Rules (Very Important)

When order reaches **assembly stage**, requests control packing.

Example:

```
Shirt x5
2 Hang
3 Fold
```

Packing result:

```
Bag 1 → 2 shirts (hanger)
Bag 2 → 3 shirts (fold)
```

This reduces delivery complaints.

---

# 8. Barcode / Tagging

For laundries with tagging.

Tag could include:

```
Order: 10582
Item: Shirt
Req: Hang + Starch
```

---

# 9. Recommended Catalog Structure

I strongly recommend splitting **special requests by category**.

Example:

```
WASHING_REQUESTS
PROCESSING_REQUESTS
FINISHING_REQUESTS
PACKING_REQUESTS
```

Why?

Because **UI filtering becomes easier**.

Example:

```
Washing
[ ] Separate Wash
[ ] Delicate

Finishing
[ ] Steam Press
[ ] Starch

Packing
[ ] Hang
[ ] Fold
```

---

# 10. My Strong Recommendation (Best Design)

Do **NOT** allow free text requests.

Instead:

```
Catalog + Optional Notes
```

Example:

```
[✓] Hang
Note: Use wooden hanger
```

This keeps:

* reports clean
* automation possible
* analytics usable

---

# 11. Advanced Feature (Future)

You can even attach requests to **service category**.

Example:

```
Dry Clean → Hang default
Laundry → Fold default
```

Configured via tenant settings.

---

# 12. The Real-World Set You Actually Need

Most laundries only use **these 8 requests**:

1. Steam Press
2. Light Starch
3. Heavy Starch
4. Hang
5. Fold
6. Separate Wash
7. Delicate
8. Perfume

Everything else is rare.

---

✅ **Conclusion**

The clean design is:

```
sys_special_request_cd
      ↓
org_order_item_special_requests
      ↓
(optional)
org_piece_special_requests
```

Combined with:

* workflow automation
* packing logic
* pricing add-ons

---
Good — this is actually a **very important architectural decision** for a laundry system. If you design it incorrectly now, later it becomes painful to fix.

The core question is:

> Should **Hang / Fold** be treated as a **Special Request** or a **Packing Rule**?

Short answer from real laundry operations:

**Hang/Fold should be a Packing Rule, not a Special Request.**

Let’s break this down.

---

# 1. Why Hang / Fold is NOT a Real Special Request

Special requests are things that **change the processing of the garment**.

Examples:

| Request       | Affects          |
| ------------- | ---------------- |
| Steam Press   | finishing stage  |
| Starch        | washing/pressing |
| Separate Wash | washing stage    |
| Delicate      | washing method   |

But **Hang / Fold** happens **after everything is finished**.

It belongs to the **assembly/packing stage**.

This is exactly the type of workflow stage used in the assembly/QA pipelines in the CleanMateX workflow architecture. 

---

# 2. Operational Flow in a Laundry

Real workflow:

```
1 Intake
2 Washing
3 Drying
4 Pressing
5 Assembly
6 Packing
7 Ready
```

Hang/Fold belongs to:

```
ASSEMBLY / PACKING
```

Not washing.

---

# 3. Correct Data Model

Instead of putting Hang/Fold in **special_request table**, create a **packing preference field**.

Example inside:

```
org_order_items_dtl
```

Add:

```
packing_method
```

Example values:

| value | meaning |
| ----- | ------- |
| HANG  | hanger  |
| FOLD  | folded  |
| BOX   | boxed   |
| BAG   | bagged  |

---

# 4. Recommended Schema

### Packing Method Catalog

```
sys_packing_method_cd
```

| column              | description |
| ------------------- | ----------- |
| packing_method_code | HANG / FOLD |
| name                | English     |
| name2               | Arabic      |
| description         |             |

---

### Order Item

```
org_order_items_dtl
```

Add:

```
packing_method_code
```

Example record:

| item  | qty | packing |
| ----- | --- | ------- |
| Shirt | 5   | HANG    |
| Towel | 3   | FOLD    |
| Suit  | 1   | HANG    |

---

# 5. Piece-Level Packing (Optional)

If you enable **piece tracking**.

Example:

```
org_order_item_pieces
```

| piece  | packing |
| ------ | ------- |
| Shirt1 | HANG    |
| Shirt2 | HANG    |
| Shirt3 | FOLD    |
| Shirt4 | FOLD    |

This works nicely with **assembly scan verification** mentioned in the platform workflow design. 

---

# 6. Default Packing Rules

Many laundries have **default rules**.

Example:

| item     | default packing |
| -------- | --------------- |
| Shirt    | HANG            |
| Pants    | HANG            |
| Towel    | FOLD            |
| Bedsheet | FOLD            |
| Suit     | HANG            |

Stored in:

```
org_product_data_mst
```

Add:

```
default_packing_method
```

So cashier doesn't need to select every time.

---

# 7. When Hang/Fold Becomes a Request

Sometimes customers override.

Example:

```
Default: Shirts → Hang
Customer: Please Fold
```

In this case:

```
packing_method_override = TRUE
```

So assembly team knows it's special.

---

# 8. UI Design (Best UX)

Counter screen:

```
Item: Shirt
Qty: 5

Packing:
(•) Hang
( ) Fold
```

Optional piece level:

```
5 Shirts

1 Hang
2 Hang
3 Fold
4 Fold
5 Hang
```

---

# 9. Operational Benefit

Separating **Special Requests** and **Packing Rules** gives cleaner operations.

Processing team sees:

```
Special Requests:
- Starch
- Delicate
```

Assembly team sees:

```
Packing:
- Hang
- Fold
```

Different teams, different screens.

---

# 10. Final Structure (Best Design)

Your system should have **two catalogs**:

### A. Special Requests

```
sys_special_request_cd
```

Examples:

* Starch
* Perfume
* Separate Wash
* Delicate

---

### B. Packing Methods

```
sys_packing_method_cd
```

Examples:

* Hang
* Fold
* Box
* Vacuum Bag

---

# 11. My Strong Professional Recommendation

For CleanMateX architecture:

```
Processing Requests → Special Requests
Packing Instructions → Packing Method
```

Never mix them.

---

✅ **CleanMateX Final Model**

```
sys_special_request_cd
sys_packing_method_cd

org_order_item_special_requests
org_order_items_dtl.packing_method_code
```

---

This is where laundry software usually **breaks operationally** if the data model is naïve.

The real question:

> Should packing be stored **per item**, **per piece**, or **per bag/package**?

The correct enterprise approach is:

**All three layers exist — but each serves a different operational purpose.**

Think of it as a **packing hierarchy**.

---

# 1. The Packing Hierarchy (Operational Reality)

Laundry packing normally happens like this:

```
Order
   ↓
Items
   ↓
Pieces
   ↓
Packages / Bags
```

Example order:

```
Order #1052
Customer: Ahmed
```

Items received:

```
5 Shirts
2 Pants
1 Suit
```

Final packing result:

```
Bag 1 → 3 Shirts (Hang)
Bag 2 → 2 Shirts + 2 Pants (Fold)
Bag 3 → 1 Suit (Hanger Cover)
```

Notice:

**Packing happens by BAG, not by item.**

---

# 2. Why Per-Item Packing Is Not Enough

If you only store packing on **order item**:

```
Shirt x5 → Hang
```

Assembly cannot represent:

```
3 hang
2 fold
```

Operations break.

---

# 3. Why Per-Piece Packing Is Also Not Enough

If you store only **per piece**:

```
Piece1 hang
Piece2 hang
Piece3 fold
Piece4 fold
Piece5 hang
```

You still don't know:

```
Which bag contains which pieces
```

Delivery teams need this.

---

# 4. Correct Enterprise Model

You need **three data layers**.

### 1️⃣ Item Level (Default Packing)

Table:

```
org_order_items_dtl
```

Fields:

```
packing_method_default
quantity
```

Example:

```
Shirt x5 → Hang
```

Purpose:

* quick order entry
* cashier speed

---

### 2️⃣ Piece Level (Optional Override)

Table:

```
org_order_item_pieces
```

Fields:

```
piece_no
packing_method
```

Example:

```
Piece1 Hang
Piece2 Hang
Piece3 Fold
Piece4 Fold
Piece5 Hang
```

Purpose:

* high-end laundries
* piece barcode tagging

---

### 3️⃣ Package / Bag Level (Final Packing)

Table:

```
org_order_packages
```

Example:

| package | type       | notes        |
| ------- | ---------- | ------------ |
| PKG1    | hanger     | 3 shirts     |
| PKG2    | bag        | folded items |
| PKG3    | suit cover | suit         |

Then link pieces to packages.

```
org_package_pieces
```

Example:

| package | piece  |
| ------- | ------ |
| PKG1    | Shirt1 |
| PKG1    | Shirt2 |
| PKG1    | Shirt5 |
| PKG2    | Shirt3 |
| PKG2    | Shirt4 |

---

# 5. This Enables Real Operational Features

## Assembly Screen

```
Assembly Station
---------------------

Scan Piece → Shirt #1
Packing → Hanger

Assign to Package → PKG1
```

---

## Package Labels

Example printed label:

```
Order 1052
Package 1/3
3 Shirts
HANGER
```

---

## Delivery Control

Driver screen:

```
Deliver:

PKG1
PKG2
PKG3
```

Not just "Order delivered".

---

# 6. Database Structure (Recommended)

```
org_orders_mst
org_order_items_dtl
org_order_item_pieces
org_order_packages
org_package_pieces
```

Simplified schema:

```
order
  ↓
order_items
  ↓
order_item_pieces
  ↓
package_pieces
  ↓
order_packages
```

---

# 7. Example Full Data

Order:

```
#1052
```

Items:

```
Shirt x5
Pants x2
Suit x1
```

Pieces:

```
S1 S2 S3 S4 S5
P1 P2
SU1
```

Packages:

```
PKG1
PKG2
PKG3
```

Mapping:

```
PKG1 → S1 S2 S5
PKG2 → S3 S4 P1 P2
PKG3 → SU1
```

---

# 8. Why This Is Powerful

This enables:

✅ assembly verification
✅ missing item detection
✅ bag labeling
✅ delivery tracking
✅ partial delivery
✅ package scanning

These are features **premium laundry ERPs** provide.

---

# 9. MVP vs Advanced

For **MVP laundries**:

```
Order Item Packing Only
```

For **advanced laundries**:

```
Piece Tracking + Package Assembly
```

Your settings system can enable this per tenant.

---

# 10. Recommended CleanMateX Feature Flag

Example setting:

```
track_individual_piece = true
assembly_package_mode = true
```

Which aligns with the configurable workflow settings described for tenants. 

---

✅ **Final Recommendation**

Design CleanMateX packing like this:

```
Default → Item
Override → Piece
Final Packing → Package
```

This structure scales from **small laundries to enterprise plants** without redesign.

===============================
---

The **Assembly Station** is the operational choke point in any laundry plant. If this screen is poorly designed, you get **mix-ups, missing pieces, wrong packing, and delivery complaints**. So the design must enforce **scan → verify → pack → close** discipline.

---

# 1. Assembly Station Objective

The station exists to **rebuild the order correctly after processing**.

Typical workflow:

```
Processing Finished
        ↓
Items arrive at Assembly
        ↓
Scan piece → Verify order
        ↓
Assign packing
        ↓
Add to package
        ↓
Close package
        ↓
Mark order READY
```

This matches the **assembly → QA → ready workflow stage** structure used in configurable workflow templates. 

---

# 2. Assembly Screen Layout (Industrial UI)

The UI must be **extremely fast and visual**.

Recommended layout:

```
--------------------------------------------------
ORDER: #1052        Customer: Ahmed
Items Expected: 8 pieces
Pieces Assembled: 6 / 8
--------------------------------------------------

SCAN ITEM
[ Barcode Scanner Field ]

Last Scanned:
Shirt #3

Packing:
(HANG) (FOLD)

Package:
PKG1  PKG2  PKG3  [+ New]

--------------------------------------------------
PACKAGE CONTENT

PKG1
- Shirt #1
- Shirt #2
- Shirt #3

PKG2
- Pants #1
- Pants #2

PKG3
(empty)

--------------------------------------------------
MISSING PIECES
Shirt #4
Shirt #5
Suit #1
--------------------------------------------------
```

---

# 3. Core Assembly Logic

### Step 1 — Scan Piece

Operator scans tag.

Example:

```
SCAN → S1052-03
```

System loads:

```
Order: 1052
Item: Shirt
Piece: 3
Packing Default: Hang
```

---

### Step 2 — Verify

System checks:

* correct order
* not already packed
* no duplicate

If duplicate:

```
⚠ Piece already assembled
```

---

### Step 3 — Assign Packing

Operator chooses:

```
Hang
Fold
Box
```

Default can auto-select.

---

### Step 4 — Assign Package

Example:

```
Add to PKG1
```

System records:

```
piece_id → package_id
```

---

### Step 5 — Update Progress

```
6 / 8 pieces assembled
```

Real-time update.

---

# 4. Package Creation Logic

Operator can create packages.

Example:

```
+ New Package
```

System generates:

```
PKG1
PKG2
PKG3
```

Package types:

| Type        | Use          |
| ----------- | ------------ |
| hanger rack | shirts       |
| plastic bag | folded items |
| suit cover  | suits        |
| box         | premium      |

---

# 5. Smart Assembly Automation

The system can help operators.

Example rules:

### Auto Package Creation

```
IF packing_method = HANG
→ add to hanger package
```

### Auto Package Split

```
IF hanger_count > 5
→ create new package
```

---

# 6. Missing Piece Detection

This is a **huge operational advantage**.

Example:

```
Expected: 8 pieces
Scanned: 7 pieces

Missing:
Suit #1
```

Assembly cannot close order until resolved.

---

# 7. QA Integration

Some laundries require **quality control before packing**.

Workflow:

```
Processing
   ↓
Assembly
   ↓
QA Check
   ↓
Packing
```

Your workflow engine already supports **QA stages**. 

---

# 8. Package Label Printing

When package closes:

Print label:

```
-------------------------
ORDER 1052
PKG 1 / 3

3 Shirts
Hang

Customer: Ahmed
-------------------------
```

Barcode:

```
PKG1052-1
```

---

# 9. Delivery Integration

Driver sees:

```
Order 1052

Packages:
PKG1
PKG2
PKG3
```

Driver must scan **each package** before delivery.

Prevents:

* missing bags
* wrong deliveries

---

# 10. Assembly Dashboard

Supervisor screen:

```
Orders in Assembly: 14
Orders Waiting QA: 6
Completed Today: 132
Missing Pieces: 2
```

Operational visibility.

---

# 11. Error Prevention Features

Good assembly software enforces:

### Duplicate Scan Protection

```
Piece already packed
```

### Wrong Order Scan

```
Piece belongs to Order 1051
```

### Mixed Order Warning

```
⚠ Attempt to mix orders
```

---

# 12. Speed Optimization

Professional plants process **hundreds of items per hour**.

So the system must support:

* **barcode scanning**
* **keyboard shortcuts**
* **auto focus**
* **big buttons**
* **touch friendly**

Example:

```
F1 → Hang
F2 → Fold
F3 → New Package
```

---

# 13. Minimal Data Flow

Assembly writes only a few tables:

```
org_order_item_pieces
org_order_packages
org_package_pieces
```

Then order status updates:

```
ASSEMBLY → READY
```

---

# 14. MVP Version

For smaller laundries you can simplify:

```
No piece tracking
No packages
Only item packing
```

Assembly screen becomes:

```
Shirt x5 → Hang
Pants x2 → Fold
Suit x1 → Hang
```

---

# 15. Critical Rule

Never allow order to become **READY** unless:

```
assembled_pieces = expected_pieces
```

This single rule prevents **most laundry mistakes**.

---

✅ **Summary**

The Assembly Station must enforce:

```
Scan → Verify → Pack → Package → Close
```

This is the **heart of operational reliability** in laundry systems.

---
=======================================


**“Smart Tagging System (QR / Barcode / RFID)”**

This determines whether CleanMateX behaves like a **basic POS** or a **true industrial laundry platform**.
If you want CleanMateX to move from **basic laundry POS → industrial-grade laundry platform**, the **tagging system** is the core infrastructure. Everything else (assembly, QA, delivery) becomes reliable only if **items are uniquely identifiable**.

So let’s design a **Smart Tagging System** properly.

---

# 1. Purpose of the Tagging System

Tagging solves the biggest laundry problems:

* lost garments
* mixed orders
* wrong delivery
* missing pieces
* rewash tracking

Without tagging, operations rely on **manual counting**, which is unreliable.

The tagging system gives **each garment a digital identity**.

---

# 2. Tagging Levels

There are three tagging strategies used in the industry.

| Level     | Used By            | Accuracy  |
| --------- | ------------------ | --------- |
| Order tag | small laundries    | low       |
| Item tag  | mid-size laundries | medium    |
| Piece tag | industrial plants  | very high |

CleanMateX should support **all three modes**.

---

# 3. Recommended Tagging Mode

Best scalable option:

**Piece-level tagging**

Example order:

```
Order 1052
5 Shirts
2 Pants
1 Suit
```

System generates pieces:

```
S1
S2
S3
S4
S5
P1
P2
SU1
```

Each piece gets a **unique tag**.

---

# 4. Tag ID Structure

You need a **globally unique but readable ID**.

Recommended format:

```
TENANT-BRANCH-ORDER-PIECE
```

Example:

```
CMX01-MCT-1052-S03
```

Meaning:

| Part  | Meaning     |
| ----- | ----------- |
| CMX01 | tenant      |
| MCT   | branch      |
| 1052  | order       |
| S03   | shirt piece |

Simplified barcode option:

```
1052-03
```

---

# 5. Barcode vs QR vs RFID

### Barcode (Most Common)

Pros:

* cheap
* fast scanning
* universal

Cons:

* needs line of sight

Best option for **MVP**.

---

### QR Code

Pros:

* more data
* smartphone scanning

Cons:

* slower industrial scanning

Good for **customer tracking**.

---

### RFID

Pros:

* scan multiple garments
* no line-of-sight
* ultra fast

Cons:

* expensive

Used by **large plants and hotel laundries**.

---

# 6. Tag Types

Laundry tags are usually:

| Type             | Usage             |
| ---------------- | ----------------- |
| paper tag        | small laundries   |
| heat seal label  | garment permanent |
| plastic loop tag | reusable          |
| RFID chip tag    | industrial        |

Most systems use:

```
Paper + barcode
```

attached with a **tagging gun**.

---

# 7. Tag Printing Workflow

At order intake:

```
Create Order
      ↓
Generate Pieces
      ↓
Print Tags
      ↓
Attach Tags
```

Example tag:

```
-------------------
Order: 1052
Item: Shirt
Piece: 3/5
Hang

|| 1052-03 ||
-------------------
```

---

# 8. Database Model

Piece table:

```
org_order_item_pieces
```

Fields:

```
piece_id
order_id
order_item_id
piece_no
tag_code
packing_method
status
```

Example record:

| piece  | tag     | status     |
| ------ | ------- | ---------- |
| Shirt3 | 1052-03 | processing |

---

# 9. Piece Status Tracking

Each piece moves through stages.

Example:

```
INTAKE
PROCESSING
ASSEMBLY
QA
PACKED
DELIVERED
```

These correspond to workflow stages defined in the system workflow templates. 

---

# 10. Scan Events

Every scan should create an **event log**.

Example table:

```
org_piece_scan_events
```

Fields:

```
piece_id
scan_type
station
user_id
timestamp
```

Example data:

| piece   | event      | station |
| ------- | ---------- | ------- |
| 1052-03 | intake     | counter |
| 1052-03 | processing | washer  |
| 1052-03 | assembly   | pack    |

This creates **full traceability**.

---

# 11. Smart Error Detection

With scanning enabled, the system can detect errors.

### Wrong Order

```
Scanned piece belongs to Order 1051
```

### Duplicate Scan

```
Piece already packed
```

### Missing Item

```
Expected pieces: 8
Scanned: 7
Missing: Suit
```

---

# 12. Customer Tracking

Customer can track items.

Example:

```
Order 1052

Shirts → Ready
Pants → Ready
Suit → Processing
```

This works because **pieces have status**.

---

# 13. Driver Delivery Scan

Driver scans package or pieces.

Example:

```
Delivering Order 1052

Scan packages:
PKG1
PKG2
PKG3
```

or

```
Scan pieces
```

This prevents wrong deliveries.

---

# 14. Tag Reprint Feature

Tags get damaged.

System must allow:

```
Reprint Tag
```

But keep the same:

```
tag_code
piece_id
```

Never create new IDs.

---

# 15. Smart Tagging Automation

Advanced plants automate tag creation.

Example:

```
Item Qty = 5
System auto creates 5 pieces
```

Operator just prints tags.

---

# 16. CleanMateX Tagging Modes

This should be configurable per tenant.

Example settings:

```
tagging_mode

ORDER
ITEM
PIECE
```

---

# 17. Why This Is Powerful

With tagging you unlock:

* assembly verification
* loss prevention
* garment traceability
* operational analytics
* delivery accuracy

Without it, the system behaves like **a basic POS**.

---

# 18. My Strong Recommendation

For CleanMateX architecture:

```
Default → ITEM TAGGING
Advanced → PIECE TAGGING
Enterprise → RFID
```

This keeps the system usable for **small laundries and large plants**.

---

If you want, we can go one step further and design something **extremely important that most laundry systems miss**:

**“Garment Identification vs Order Pieces”**

Because the difference between those two concepts determines whether the system can support **alterations, repairs, and garment history across orders**.

================================

Now we’re entering the **deep architecture layer** that separates a **simple laundry POS** from a **true garment lifecycle platform**.
Most laundry systems confuse **Order Pieces** with **Garment Identity**. That creates serious limitations later.

We’re going to design this **properly, end-to-end, without gaps**.

---

# 1. The Core Concept

You must separate two completely different concepts:

| Concept     | Meaning                                                     |
| ----------- | ----------------------------------------------------------- |
| Garment     | A physical clothing item owned by a customer                |
| Order Piece | A temporary processing instance of that garment in an order |

Think of it like this:

```text
Garment (permanent)
        ↓
Order Piece (temporary)
        ↓
Workflow Processing
```

Example:

Customer Ahmed owns a shirt.

That shirt might be washed **100 times across many orders**.

So:

```text
Garment = persistent asset
Order Piece = per-order processing record
```

---

# 2. Real-World Example

Customer brings same shirt multiple times.

Order 1052

```
Piece: Shirt #1
Tag: 1052-01
```

Order 1098

```
Piece: Shirt #1
Tag: 1098-02
```

Both refer to the **same garment**.

If you don’t model this, you **lose garment history**.

---

# 3. Why Garment Identity Matters

Without garment identity you cannot support:

| Feature               | Reason                |
| --------------------- | --------------------- |
| Garment history       | previous cleanings    |
| Damage tracking       | repeated issues       |
| VIP garment care      | special instructions  |
| Alteration tracking   | sleeve shortening etc |
| Repair records        | zipper fixes          |
| Lost garment recovery | traceability          |
| Permanent RFID tags   | identity chip         |

Enterprise laundries **require this**.

---

# 4. CleanMateX Data Architecture

We introduce a **new entity layer**.

```
CUSTOMER
   ↓
GARMENTS
   ↓
ORDERS
   ↓
ORDER_ITEMS
   ↓
ORDER_PIECES
```

---

# 5. Garment Master Table

Table:

```
org_customer_garments_mst
```

Fields:

| field         | purpose             |
| ------------- | ------------------- |
| garment_id    | unique garment      |
| tenant_org_id | tenant              |
| customer_id   | owner               |
| garment_type  | shirt/pants/etc     |
| brand         | optional            |
| color         | optional            |
| fabric        | optional            |
| rfid_code     | optional            |
| care_notes    | special care        |
| status        | active/lost/retired |
| created_at    | timestamp           |

Example record:

| garment_id | type  | color |
| ---------- | ----- | ----- |
| G12345     | shirt | white |

---

# 6. Garment Tagging Strategy

Two possibilities.

### Temporary Tag (Order Only)

Tag changes each order.

Example:

```
1052-03
```

Link to garment later if identified.

---

### Permanent Tag (RFID or heat seal)

Tag stays forever.

Example:

```
RFID-00094822
```

Linked directly to garment.

Enterprise plants use this.

---

# 7. Order Pieces Table

This table represents **garment processing in an order**.

```
org_order_item_pieces
```

Fields:

| field          | purpose            |
| -------------- | ------------------ |
| piece_id       | unique record      |
| order_id       | order              |
| order_item_id  | item               |
| garment_id     | optional reference |
| tag_code       | temporary tag      |
| piece_no       | 1..n               |
| packing_method | hang/fold          |
| status         | workflow stage     |

Example:

| piece | garment | order |
| ----- | ------- | ----- |
| P991  | G12345  | 1052  |

---

# 8. Garment Recognition Logic

At intake, system decides:

### Scenario 1 – Known Garment

Operator scans RFID.

System loads:

```
Garment G12345
Owner Ahmed
Type Shirt
Care Notes: Delicate
```

Then create order piece referencing garment.

---

### Scenario 2 – Unknown Garment

System creates **temporary garment placeholder**.

```
garment_id = NULL
```

Later customer profile may link it.

---

# 9. Garment Care Profile

Each garment can store care instructions.

Example:

| field        | value    |
| ------------ | -------- |
| wash_mode    | delicate |
| press_method | steam    |
| packing      | hang     |

This overrides default product settings.

---

# 10. Garment Damage Tracking

Table:

```
org_garment_issues
```

Example:

| garment | issue               |
| ------- | ------------------- |
| G12345  | button missing      |
| G12345  | stain not removable |

This protects the laundry from disputes.

---

# 11. Garment Photo Archive

Store garment images.

Table:

```
org_garment_media
```

Examples:

* intake photo
* damage photo
* repair result

This is extremely useful in **premium services**.

---

# 12. Garment Lifecycle

A garment can pass through many states.

```
ACTIVE
IN_PROCESS
REPAIR
LOST
DISCARDED
```

If customer discards item:

```
status = retired
```

---

# 13. Order Creation Flow (Full)

This is the **best-practice intake workflow**.

```
Customer arrives
       ↓
Identify customer
       ↓
Select service
       ↓
Add items
       ↓
Create pieces
       ↓
Check garment identity
       ↓
Generate tags
       ↓
Print receipt
```

---

# 14. Processing Flow

Each piece moves through workflow stages.

```
INTAKE
↓
WASH
↓
DRY
↓
PRESS
↓
ASSEMBLY
↓
QA
↓
PACK
↓
READY
↓
DELIVERED
```

Workflow templates control these transitions.

---

# 15. Piece Event Tracking

Every stage change logs an event.

Table:

```
org_piece_events
```

Example:

| piece | event    |
| ----- | -------- |
| P991  | intake   |
| P991  | washing  |
| P991  | pressing |
| P991  | assembly |

This creates **full traceability**.

---

# 16. Assembly & Packaging

After processing:

```
Pieces
   ↓
Packages
```

Tables:

```
org_order_packages
org_package_pieces
```

Example:

```
PKG1
  Shirt1
  Shirt2

PKG2
  Suit
```

---

# 17. Delivery Tracking

Driver scans package.

Table:

```
org_delivery_pod
```

Proof of delivery may include:

* OTP
* signature
* photo

---

# 18. Customer Garment History

Now the platform can show:

```
Garment: White Shirt

Cleaned: 12 times
Last cleaned: Jan 3
Issues: None
Preferred packing: Hang
```

This enables **premium garment care**.

---

# 19. Analytics Possibilities

Garment identity unlocks powerful analytics.

Examples:

| metric                     | insight                |
| -------------------------- | ---------------------- |
| most cleaned garment types | demand                 |
| average garment lifespan   | textile wear           |
| damage rate                | quality control        |
| wash cycles per garment    | operational efficiency |

---

# 20. Why This Architecture Is Future-Proof

This model supports:

* small laundries
* large processing plants
* hotel linen tracking
* alteration services
* luxury garment care
* RFID automation

No redesign needed later.

---

# 21. CleanMateX Final Data Model

Complete structure:

```
org_customers_mst
      ↓
org_customer_garments_mst
      ↓
org_orders_mst
      ↓
org_order_items_dtl
      ↓
org_order_item_pieces
      ↓
org_piece_events
      ↓
org_order_packages
      ↓
org_package_pieces
      ↓
org_delivery_pod
```

This architecture fits naturally into the **multi-tenant, workflow-driven platform design** used by the system. 

---

# 22. The Most Important Rule

Always enforce:

```
Piece = processing instance
Garment = persistent identity
```

Never merge them.

That single decision prevents **future architecture collapse**.

---

✅ **Result**

With this design CleanMateX becomes:

* POS
* production control system
* garment lifecycle manager
* logistics tracker

All in one platform.

---

If you want, the **next thing I can design (very advanced)** is the **Ultimate Laundry Data Model — about 35 core tables used by enterprise laundry ERPs**, optimized for **Supabase/PostgreSQL and multi-tenant SaaS** so your system scales to **thousands of laundries without schema changes**.

=============================

Below is a **complete enterprise-grade laundry data architecture** suitable for a **multi-tenant SaaS platform like CleanMateX**. This is the kind of structure used by large laundry ERPs, but optimized for **PostgreSQL + Supabase + multi-tenant RLS**. The goal is **no functional gaps**, while still allowing **MVP → enterprise scaling**.

I’ll structure it by **domains**, because mixing everything in one flat schema is how systems become unmaintainable.

---

# 1. Core Platform Layer (Multi-Tenant Foundation)

Every operational table must include `tenant_org_id` for isolation.

### Tenant Master

```
org_tenants_mst
```

Fields

```
tenant_org_id (PK)
tenant_code
name
name2
country_code
currency_code
timezone
status
created_at
```

### Branches

```
org_branches_mst
```

Fields

```
branch_id (PK)
tenant_org_id
branch_code
name
name2
address
phone
geo_location
status
```

Branches matter because:

* orders belong to branches
* processing may occur in different plants

This aligns with the **multi-tenant architecture and composite FK pattern** used for tenant isolation. 

---

# 2. Customer Domain

Customers exist at two levels: **global identity** and **tenant relationship**.

### Global Customer Identity

```
sys_customers_mst
```

Fields

```
customer_id (PK)
phone
email
full_name
full_name2
created_at
```

### Tenant Customer

```
org_customers_mst
```

Fields

```
tenant_customer_id (PK)
tenant_org_id
customer_id
branch_id
customer_type (B2C/B2B)
loyalty_points
notes
status
```

This allows one customer to exist across **multiple laundries** if needed.

---

# 3. Customer Garments (Persistent Identity)

This is where **garment lifecycle** begins.

```
org_customer_garments_mst
```

Fields

```
garment_id (PK)
tenant_org_id
customer_id
garment_type
color
fabric
brand
rfid_code
care_notes
status
created_at
```

Optional metadata:

```
last_cleaned_at
clean_count
damage_flag
```

---

# 4. Service Catalog

Defines what services the laundry offers.

### Service Categories

```
sys_service_category_cd
```

Examples

```
LAUNDRY
DRY_CLEAN
PRESS_ONLY
ALTERATION
```

### Tenant Service Activation

```
org_service_category_cf
```

Fields

```
tenant_org_id
service_category_id
workflow_template_id
pricing_strategy
is_active
```

Service categories may use **different workflow templates**, which the workflow engine supports. 

---

# 5. Product / Item Catalog

Represents garment types processed by the laundry.

```
org_product_data_mst
```

Examples

```
Shirt
Pants
Suit
Dress
Bedsheet
```

Fields

```
product_id
tenant_org_id
product_code
name
name2
default_packing_method
base_price
category_id
is_active
```

---

# 6. Orders Domain

### Orders Master

```
org_orders_mst
```

Fields

```
order_id (PK)
tenant_org_id
branch_id
customer_id
order_type
order_status
service_category_id
ready_by_time
total_amount
currency
created_at
```

Statuses

```
NEW
PROCESSING
ASSEMBLY
READY
DELIVERED
CLOSED
```

---

# 7. Order Items

Represents garment types within the order.

```
org_order_items_dtl
```

Fields

```
order_item_id (PK)
order_id
tenant_org_id
product_id
quantity
unit_price
packing_method_default
notes
```

Example

```
Order 1052
5 Shirts
2 Pants
```

---

# 8. Order Pieces (Operational Units)

Each garment piece processed.

```
org_order_item_pieces
```

Fields

```
piece_id (PK)
tenant_org_id
order_id
order_item_id
garment_id
tag_code
piece_no
packing_method
status
```

Statuses

```
INTAKE
PROCESSING
PRESSING
ASSEMBLY
QA
PACKED
DELIVERED
```

---

# 9. Piece Event Tracking

Every scan or state change recorded.

```
org_piece_events
```

Fields

```
event_id
piece_id
tenant_org_id
event_type
station_code
user_id
timestamp
notes
```

Examples

```
SCAN_INTAKE
WASH_START
PRESS_COMPLETE
ASSEMBLY_SCAN
```

This creates **full garment traceability**.

---

# 10. Special Requests

Catalog

```
sys_special_request_cd
```

Examples

```
STARCH_LIGHT
STARCH_HEAVY
PERFUME
SEPARATE_WASH
DELICATE
```

Order linkage

```
org_order_item_special_requests
```

Fields

```
id
order_item_id
request_code
extra_price
notes
```

---

# 11. Packing & Assembly

Packing method catalog

```
sys_packing_method_cd
```

Examples

```
HANG
FOLD
BOX
VACUUM
```

---

### Packages

Represents actual delivery units.

```
org_order_packages
```

Fields

```
package_id
tenant_org_id
branch_id
order_id
package_code
package_type
weight
status
created_at
```

### Package Pieces

```
org_package_pieces
```

Fields

```
package_id
piece_id
tenant_org_id
```

This supports **assembly verification and package labeling**.

---

# 12. Workflow Engine

Templates define operational stages.

```
workflow_template_cd
workflow_template_stages
workflow_template_transitions
```

Examples

```
INTAKE
PROCESSING
ASSEMBLY
QA
READY
DELIVERED
```

These templates control order progression dynamically. 

---

# 13. Delivery & Logistics

Delivery routes

```
org_delivery_routes
```

Fields

```
route_id
tenant_org_id
driver_id
route_date
status
```

Proof of delivery

```
org_delivery_pod
```

Fields

```
pod_id
order_id
package_id
driver_id
otp_code
signature_url
photo_url
timestamp
```

---

# 14. Finance Domain

Invoices

```
org_invoice_mst
```

Fields

```
invoice_id
tenant_org_id
order_id
invoice_number
subtotal
tax_amount
total_amount
status
```

Payments

```
org_payments_dtl_tr
```

Fields

```
payment_id
tenant_org_id
invoice_id
payment_method
amount
payment_status
transaction_ref
timestamp
```

---

# 15. Inventory (Optional)

Consumables used by plant.

```
org_inventory_items
```

Examples

```
detergent
starch
plastic bags
hangers
```

Transactions

```
org_inventory_movements
```

Fields

```
movement_id
item_id
quantity
movement_type
timestamp
```

---

# 16. User & Roles

Users

```
org_users_mst
```

Fields

```
user_id
tenant_org_id
branch_id
name
role
status
```

Roles

```
RECEPTION
PROCESSING
ASSEMBLY
QA
DRIVER
ADMIN
```

Permissions can be role-based.

---

# 17. Media Storage

Photos and documents.

```
org_media_files
```

Examples

```
garment_photo
damage_photo
delivery_photo
receipt_pdf
```

Fields

```
media_id
entity_type
entity_id
file_url
created_at
```

---

# 18. Notifications

Used for SMS, WhatsApp, push.

```
org_notifications_log
```

Fields

```
notification_id
tenant_org_id
customer_id
channel
message
status
sent_at
```

---

# 19. Analytics / Reporting

Aggregated metrics.

```
org_daily_metrics
```

Fields

```
metric_date
tenant_org_id
orders_created
orders_delivered
revenue
pieces_processed
```

These tables support dashboards.

---

# 20. Full Enterprise Table Map

Final architecture:

```
TENANT
 ├─ branches
 ├─ customers
 │   └─ garments
 ├─ products
 ├─ services
 ├─ orders
 │   ├─ order_items
 │   │   └─ order_pieces
 │   │       └─ piece_events
 │   ├─ special_requests
 │   └─ packages
 │       └─ package_pieces
 ├─ invoices
 │   └─ payments
 ├─ delivery_routes
 │   └─ delivery_pod
 ├─ inventory
 ├─ users
 ├─ notifications
 └─ analytics
```

This structure mirrors **enterprise-scale SaaS architecture for laundry operations**, designed to support workflow-driven processing and multi-tenant isolation. 

---

# 21. Critical Design Rules

To keep the system stable long-term:

1. **Every tenant table includes `tenant_org_id`.**
2. **Pieces represent processing units.**
3. **Garments represent persistent customer assets.**
4. **Packages represent delivery units.**
5. **Events capture operational traceability.**

Breaking these rules causes architecture collapse later.

---

# 22. What This Architecture Enables

With this model CleanMateX supports:

* small counter laundries
* industrial processing plants
* hotel linen operations
* garment lifecycle tracking
* delivery logistics
* enterprise analytics

All without changing the schema later.

---


