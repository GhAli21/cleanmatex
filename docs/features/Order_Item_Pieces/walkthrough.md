# Walkthrough: Polymorphic Piece UI Architecture

## Overview
I have successfully executed the refactoring of the Order Pieces UI. The monolithic "God component" (`PieceCard.tsx`) has been completely replaced with a robust, scalable Polymorphic UI Architecture. This ensures that each page (Intake, Processing, Assembly, etc.) gets a highly specialized piece card without duplicating base layouts or styles.

## Changes Made

### 1. Created `PieceBaseCard`
A new core shell component that standardizes the visual container, identity (icon, ID, generic status), RTL support, and rejection highlighting. It exposes three React Node slots (`actionSlot`, `detailsSlot`, `statusSlot`) for wrappers to inject custom markup.

### 2. Created Specialized Mode Wrappers
- **`IntakePieceCard`**: Displays the full 6-kind preference taxonomy (Service, Packing, Conditions, Color) using `PreferenceChip` styling. Includes editing and splitting actions.
- **`ProcessingPieceCard`**: Optimized for KanBan boards and bulk operations. Replaces small checkboxes with a massive, touch-friendly bulk selector. Displays only critical warnings (Damages) and the `last_step` dropdown.
- **`SortingPieceCard`**: Implements inline barcode scanning capabilities and visual tag assignment statuses.
- **`AssemblyPieceCard`**: Displays packing instructions prominently and provides a scan-to-assemble workflow.
- **`QCPieceCard`**: Highlights specific inspection criteria (damages/stains) and provides massive "Rewash" and "Pass" action buttons.

### 3. Integrated with the App
- Updated `PieceList.tsx` and `OrderPiecesManager.tsx` to accept a new `mode` prop.
- Depending on the `mode` provided by the parent route/page, `PieceList` dynamically routes piece data to the correct wrapper.
- Deleted the legacy `PieceCard.tsx` and removed its exports from `index.ts`.

### 4. Documentation and Storybook
- **Documentation**: Wrote architectural documentation for the new system at [docs/features/orders/pieces_ui_architecture.md](file:///f:/jhapp/cleanmatex/docs/features/orders/pieces_ui_architecture.md) following the rules in the `documentation` skill.
- **Storybook**: Created a comprehensive, RTL-aware set of stories at [web-admin/src/features/orders/ui/pieces/Pieces.stories.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/orders/ui/pieces/Pieces.stories.tsx) to showcase each wrapper context independently.

## Verification
- Code has been written specifically utilizing `@ui/primitives` per `AGENTS.md` rules.
- Polymorphic routing effectively removes conditional bloat inside render functions.
- The system is completely backward-compatible via `PieceList` defaulting to the `'intake'` mode if not provided.

> [!TIP]
> To see the new components in isolation, run `npm run storybook` and navigate to **Features/Orders/Pieces**.
