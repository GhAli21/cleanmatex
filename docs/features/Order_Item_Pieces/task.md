# Execution Tasks: Polymorphic Pieces UI

- `[x]` **Phase 1: Foundation & Base Shell**
  - `[x]` Create `PieceBaseCard.tsx` using Cmx primitives
- `[x]` **Phase 2: Mode Wrappers Implementation**
  - `[x]` Create `IntakePieceCard.tsx` implementing the 6-kind taxonomy
  - `[x]` Create `ProcessingPieceCard.tsx` implementing KanBan/Bulk behaviors
  - `[x]` Create `SortingPieceCard.tsx` implementing barcode scanning behavior
  - `[x]` Create `AssemblyPieceCard.tsx` (for Assembly pages)
  - `[x]` Create `QCPieceCard.tsx` (for Quality Check pages)
- `[x]` **Phase 3: Consumer Integration**
  - `[x]` Modify `OrderPiecesManager.tsx` to accept the `mode` prop
  - `[x]` Modify `PieceList.tsx` to route data to the appropriate wrapper
  - `[x]` Delete legacy `PieceCard.tsx`
- `[x]` **Phase 4: Documentation (Final Step)**
  - `[x]` Use the `documentation` skill to document the new Polymorphic Piece UI architecture
  - `[x]` Create/update Storybook stories for the new components using the `storybook` skill
