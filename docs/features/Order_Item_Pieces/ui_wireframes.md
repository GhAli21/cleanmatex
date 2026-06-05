# Piece Card UI Sketches & Wireframes

Below are the structural wireframes and conceptual visual directions for the primary modes of the Polymorphic Pieces UI across the entire SaaS lifecycle.

## 1. Intake & Edit Order Mode (`IntakePieceCard.tsx`)

**Goal:** Rapid data entry, preference selection, and clear financial summaries.
**Context:** Used at the Point of Sale or when an admin is editing an order.

### Conceptual Visual Direction
![Intake Mode Mockup](/C:/Users/JHNLP/.gemini/antigravity-ide/brain/484c76e2-b928-43bd-b8b1-2806c4ddeebd/intake_piece_card_ui_1780612697467.png)

### Structural Wireframe
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 👔 [Icon]  Piece 1: Men's Suit Jacket                        [ $12.50 ]     │
│             Barcode: [ Pending ]                                            │
│                                                                             │
│  [PREFERENCES]                                              [ACTIONS]       │
│  ╭──────────────╮ ╭────────────────╮ ╭──────────────╮       [ ✏️ Edit ]     │
│  │ 🔵 Hand Wash │ │ 📦 Folded      │ │ 🔴 Red Stain │       [ ✂️ Split]     │
│  │ +2.00 OMR    │ │ +0.00 OMR      │ │ +0.00 OMR    │       [ ❌ Drop ]     │
│  ╰──────────────╯ ╰────────────────╯ ╰──────────────╯                       │
│                                                                             │
│  [NOTES] _________________________________________________________________  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Processing Mode (`ProcessingPieceCard.tsx`)

**Goal:** High throughput, fast state transitions, bulk selection.
**Context:** Used on the factory floor (tablets/touchscreens) for Washing, Ironing.

### Conceptual Visual Direction
![Processing Mode Mockup](/C:/Users/JHNLP/.gemini/antigravity-ide/brain/484c76e2-b928-43bd-b8b1-2806c4ddeebd/processing_piece_card_ui_1780612709250.png)

### Structural Wireframe
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│ 👔 [Icon]  Piece 1: Men's Suit Jacket                       [ STATUS ]      │
│             Barcode: 10048291039                            [ WASHING ]     │
│                                                                             │
│  [WARNINGS]                                                 [BULK ACTION]   │
│  ⚠️ DRY CLEAN ONLY                                                          │
│  ⚠️ PRE-EXISTING DAMAGE                                       [   ]         │
│                                                            (Massive Box)    │
│  [NEXT STEP]                                                                │
│  [ Dropdown: Send to Ironing ▾ ]                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Sorting / Preparation Mode (`SortingPieceCard.tsx`)

**Goal:** Error-free identification and physical tagging.
**Context:** Used in the sorting room with barcode scanners.

### Structural Wireframe
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 👔 [Icon]  Piece 1: Men's Suit Jacket                                       │
│                                                                             │
│  [TAG ASSIGNMENT]                                                           │
│  Current: [ PENDING TAG ]                                                   │
│                                                                             │
│  [ SCAN BARCODE TO ASSIGN ] _____________________________   [ 🖨️ PRINT ]    │
│  (Input field auto-focused and massive)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Quality Check Mode (`QCPieceCard.tsx`)

**Goal:** Verification against damages and stain removal success.
**Context:** Used by the QC inspector before assembly.

### Structural Wireframe
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 👔 [Icon]  Piece 1: Men's Suit Jacket                                       │
│             Barcode: 10048291039                                            │
│                                                                             │
│  [INSPECTION CRITERIA]                                      [DECISION]      │
│  🔴 Has Pre-existing Damage: Tear on sleeve               [ ✔️ PASS ]     │
│  🔵 Stain Treatment Requested                             [ ❌ RE-WASH ]  │
│                                                                             │
│  📸 [ View Intake Photo ]                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Assembly / Ready / Packing Mode (`AssemblyPieceCard.tsx`)

**Goal:** Grouping pieces back into the original order and verifying packing preferences.
**Context:** Final stage before racking or delivery.

### Structural Wireframe
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 👔 [Icon]  Piece 1: Men's Suit Jacket                                       │
│             Barcode: 10048291039                                            │
│                                                                             │
│  [ASSEMBLY STATUS]  [ 2 of 3 Pieces Found ]                                 │
│  [============------]                                                       │
│                                                                             │
│  [PACKING INSTRUCTIONS]                                                     │
│  📦 FOLDED (Do not hang)                                                    │
│                                                                             │
│  [ SCAN TO MARK ASSEMBLED ] __________________________                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Delivery Manifest / Reports Mode (`ReportPieceRow.tsx`)

**Goal:** Density, data aggregation, and rapid reading.
**Context:** Reports dashboards or driver delivery manifests. No editing allowed.

### Structural Wireframe (Table Row)
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Barcode     | Type         | Packing | Damages? | Status       | Price      │
│ 10048291039 | 👔 Jacket    | Folded  | Yes      | 🟢 Ready     | $12.50     │
│ 10048291040 | 👔 Trousers  | Folded  | No       | 🟢 Ready     | $10.00     │
│ 10048291041 | 👕 Shirt     | Hanger  | No       | 🔵 Ironing   | $ 5.00     │
└─────────────────────────────────────────────────────────────────────────────┘
*(Note: Not a card, but a highly dense data table row for scanning large volumes)*
```

## Implementation Rules (Cmx Design System)
1. **Icons:** Use Lucide icons representing `garmentType` from the DB.
2. **Preference Pills:** Rendered via `<PreferenceChip>` from `@ui/primitives`, pulling `extra_price` from `org_order_preferences_dtl`.
3. **Status Badges:** Rendered via `<PieceStatusBadge>` to ensure correct RTL ordering.
4. **Massive Checkbox:** In Processing mode, override the default `<CmxCheckbox>` classes to `w-8 h-8` for fat-finger touch targets on industrial tablets.
