# Implement Polymorphic Pieces UI Architecture

This plan details the refactoring of the `PieceCard` component into a polymorphic architecture. Currently, `PieceCard.tsx` operates as a monolithic "God component," using extensive conditional logic (`if (bulkSelectMode)`, `if (readOnly)`, `if (showSplitCheckbox)`) to handle diverse UX requirements across different screens (e.g., Intake vs. Processing). 

By separating the visual shell from its context-specific behaviors, we can dramatically improve maintainability and create hyper-optimized UIs for different workflows.

## User Review Required
> [!IMPORTANT]  
> This refactor will touch components currently used in `OrderPiecesManager` and `processing-piece-row.tsx`. Please review the component boundaries proposed below before execution.

## Open Questions
> [!QUESTION]  
> Are there any new views planned soon (e.g., a dedicated "Assembly" or "Racking" screen) that should have their own specialized Piece Card wrapper, or should we stick to Intake and Processing for now?

## Proposed Changes

### 1. Core Component Refactoring

We will break `PieceCard.tsx` into a Base Shell and specific Mode Wrappers.

#### [NEW] `web-admin/src/features/orders/ui/pieces/PieceBaseCard.tsx`
- **Responsibility:** Renders the physical representation of the piece (Icon, Sequence ID, Barcode, Status Badge).
- **Props:** Accepts ReactNode slots (`actionSlot`, `detailsSlot`, `statusSlot`) to allow parent wrappers to inject context-specific UI.
- **Dependencies:** Exclusively uses `@ui/primitives` (`CmxCard`, etc.). Contains zero business logic or state mutations.

#### [NEW] `web-admin/src/features/orders/ui/pieces/IntakePieceCard.tsx`
- **Responsibility:** The wrapper used during Order Creation and Modification.
- **Injections:**
  - `detailsSlot`: Renders `PiecePreferencesPills`. Based on the canonical preference architecture, this must handle all 6 primary `preference_sys_kind` variants: `service_prefs`, `packing_prefs`, `condition_stain`, `condition_damag`, `color`, and `note`. Crucially, it must format and display `extra_price` surcharges (e.g. "+0.400 OMR") alongside the preference name using the existing `PreferenceChip` components.
  - `actionSlot`: Renders "Edit Preferences" button which opens the `PieceKindPickerDialog` (the master modal for routing to `ServicePreferenceSelector`, `PackingPreferenceSelector`, or color swatches). Also renders the "Split" checkbox.
  - `statusSlot`: Renders the `notes` explicitly (since notes are a specific preference kind now) and Rack Location.

#### [NEW] `web-admin/src/features/orders/ui/pieces/ProcessingPieceCard.tsx`
- **Responsibility:** The wrapper used on the factory floor (Washing/Ironing).
- **Injections:**
  - `actionSlot`: Renders the massive `CmxCheckbox` for bulk selection.
  - `detailsSlot`: Renders a streamlined view of the `last_step` dropdown and critical warnings (e.g. derived from `org_order_preferences_dtl` where `preference_sys_kind` is `condition_damag` or `condition_special`). It deliberately hides purely pricing-related preferences to reduce clutter on the factory floor.
- **Behavior:** Optimized for fast patch updates to the backend via bulk actions.

### 2. Preference Architecture Integration
- **Strict Adherence:** The new wrappers will fully adhere to `docs/dev/preferences-architecture-reference.md`.
- **Data Source:** Ensure all preference display logic within `PieceBaseCard` and its wrappers correctly reads from `piece.servicePrefs`, `piece.packingPrefCode`, `piece.conditions`, and `piece.colorCodes` (which map back to `org_order_preferences_dtl`).
- **No Operational Fallbacks:** Do not rely on legacy denormalized columns on `org_order_item_pieces_dtl` for preferences; always pass the correctly resolved preference arrays.

### 2. Updating Consumers

#### [MODIFY] `web-admin/src/features/orders/ui/PieceList.tsx`
- Update to conditionally render `IntakePieceCard` or `ProcessingPieceCard` based on a new `mode` prop passed down from `OrderPiecesManager`, instead of passing 15 different boolean flags to a single `PieceCard`.

#### [MODIFY] `web-admin/src/features/orders/ui/OrderPiecesManager.tsx`
- Add a `mode: 'intake' | 'processing' | 'sorting'` prop.
- Remove redundant props like `bulkSelectMode`, `showSplitCheckbox` as these will be inherently handled by the chosen mode wrapper.

#### [DELETE] `web-admin/src/features/orders/ui/PieceCard.tsx`
- Remove the legacy God component once the polymorphic structure is fully wired.

## Execution Phases & Tasks

The execution will be tracked in a `task.md` artifact, which will be updated after **each step** to reflect real-time progress.

### Phase 1: Foundation & Base Shell
- [ ] Create `PieceBaseCard.tsx` using Cmx primitives.
- [ ] Update `task.md` status to mark Phase 1 complete.

### Phase 2: Mode Wrappers Implementation
- [ ] Create `IntakePieceCard.tsx` implementing the 6-kind taxonomy.
- [ ] Create `ProcessingPieceCard.tsx` implementing KanBan/Bulk behaviors.
- [ ] Create `SortingPieceCard.tsx` implementing barcode scanning behavior.
- [ ] Update `task.md` status to mark Phase 2 complete.

### Phase 3: Consumer Integration
- [ ] Modify `OrderPiecesManager.tsx` to accept the `mode` prop.
- [ ] Modify `PieceList.tsx` to route data to the appropriate wrapper.
- [ ] Delete legacy `PieceCard.tsx`.
- [ ] Update `task.md` status to mark Phase 3 complete.

### Phase 4: Documentation (Final Step)
- [ ] Use the `documentation` skill to document the new Polymorphic Piece UI architecture.
- [ ] Create/update Storybook stories for the new components using the `storybook` skill.
- [ ] Update `task.md` status to mark Phase 4 complete.

## Verification Plan

### Automated Tests
- Run `npm run typecheck` to ensure the new prop signatures on the Piece Cards align with existing data models.
- Run `npm run lint` to ensure no restricted UI imports slipped through.

### Manual Verification
- **Intake Flow:** Open a New Order screen, ensure piece preferences can be edited and saved.
- **Processing Flow:** Navigate to a processing page, ensure bulk selection works and checkboxes are properly aligned.
- **RTL Testing:** Switch locale to Arabic, verify that the injected slots in `PieceBaseCard` maintain correct logical ordering (actions on the left, icon on the right).
