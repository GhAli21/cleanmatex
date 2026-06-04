# Polymorphic Pieces UI Architecture

## Overview
The order pieces UI has been refactored from a "God component" (`PieceCard.tsx`) into a polymorphic shell-and-wrapper architecture. This change isolates domain-specific logic (e.g., Intake vs Processing vs Sorting) into dedicated, highly focused wrappers while maintaining a unified visual identity and layout through a single base shell component (`PieceBaseCard`).

## Architecture

### Base Shell: `PieceBaseCard`
`PieceBaseCard` provides the standard layout, visual identity (CmxCard), piece sequence number, RTL support, and rejection styling. It exposes three "slots" for wrappers to inject custom behavior:
- `actionSlot`: For primary actions (e.g., Edit Preferences, Bulk Select, Rewash/Pass).
- `detailsSlot`: For primary information display (e.g., Preference Pills, Step Dropdowns, Packing Instructions).
- `statusSlot`: For supplementary or full-width context (e.g., Notes, Rack Location, Tag Status).

### Mode Wrappers
The system implements 5 specialized wrappers, each designed for a specific operational context.

#### 1. `IntakePieceCard`
- **Context:** Order creation and editing.
- **Behavior:** Implements the 6-kind preference taxonomy (Service Prefs, Packing Prefs, Conditions, Colors). Renders preference pills with pricing formatting using the `PreferenceChip` components logic. Allows editing notes and rack locations.

#### 2. `ProcessingPieceCard`
- **Context:** Laundry processing pipeline (KanBan views).
- **Behavior:** Optimized for touch interfaces. Uses a massive `CmxCheckbox` for bulk selection. Hides purely pricing-related preferences to reduce clutter, showing only critical warnings (Damages, Specials). Displays the processing `last_step` dropdown.

#### 3. `SortingPieceCard`
- **Context:** Post-processing sorting and tagging.
- **Behavior:** Implements barcode scanning behavior for tag assignment. Highlights pending vs assigned tag status. Exposes a Print Tag action.

#### 4. `AssemblyPieceCard`
- **Context:** Racking and final assembly.
- **Behavior:** Prominently displays packing instructions. Includes a barcode scanner to mark items as assembled.

#### 5. `QCPieceCard`
- **Context:** Quality control inspection.
- **Behavior:** Filters preferences to display only inspection criteria (stains, damages). Replaces standard actions with large, highly visible "Pass" and "Rewash" buttons.

## Implementation Details

### Routing (`PieceList.tsx`)
The `PieceList` component now accepts a `mode` prop (`'intake' | 'processing' | 'sorting' | 'assembly' | 'qc'`). Based on this prop, it dynamically routes the piece data to the appropriate mode wrapper instead of the legacy `PieceCard`.

### Manager Integration (`OrderPiecesManager.tsx`)
`OrderPiecesManager` also accepts the `mode` prop and passes it down to `PieceList`. Consumers embedding the manager must specify the intended mode based on the current page context.

## Best Practices
- **Never add conditional mode logic to `PieceBaseCard`.** All context-specific behavior must reside in the respective mode wrapper.
- **Creating new modes:** If a new page requires a completely different piece interaction paradigm, create a new wrapper (e.g., `DeliveryPieceCard`) and add it to the routing logic in `PieceList`.
