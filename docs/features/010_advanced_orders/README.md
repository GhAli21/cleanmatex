# Advanced Orders

**Status:** Active feature cluster with mixed historical material  
**Last Updated:** 2026-04-30

## Overview

This folder contains the later-order-flow documentation that grew beyond the original order-intake scope. It covers the new-order experience, processing details, payment integration work, piece tracking, and related redesign efforts.

## Current Implementation Reality

This is not a single clean PRD pack. It is a mixed working set that includes:

- current implementation-oriented notes for new order and processing UX
- payment-related implementation summaries
- redesign and enhancement plans
- older PRD variants and archived drafts under `old/` and other historical files

The most implementation-relevant documents in this folder are the new-order and processing summaries, while several legacy PRD variants should be treated as historical context rather than canonical current state.

## Recommended Reading Order

Start with:

1. `IMPLEMENTATION_COMPLETE.md`
2. `NEW_ORDER_PAGE_DOCUMENTATION.md`
3. `NEW_ORDER_QUICK_REFERENCE.md`
4. `PAYMENT_IMPLEMENTATION_SUMMARY.md`
5. `Processing_Details_Enhancement_Summary.md`

**Planning (New Order UI):**

- **[New Order — Edit Item Notes / piece preferences UI (PRD outline)](../orders/new_order_piece_notes_preferences_ui_prd.md)** — piece-level summary row + detail drawer/sheet, states, empty/error handling, accessibility, phased rollout. Complements the wizard docs above when improving step “Edit Item Notes.”

Use these older materials only for historical comparison:

- `old/`
- `clde/PRD_010_Advanced_Orders_Implementation.md`
- older versioned PRD documents and one-off plan files

## Scope Covered Here

- new-order page evolution
- payment workflow integration in the order experience
- processing screen/detail enhancements
- piece-level and item-level order handling
- redesign notes for order-entry UX

## Relationship To Other Order Docs

- foundational intake work lives under `../004_order_intake/`
- workflow migration work lives under `../orders_workflow_migration/`
- older payment/order-plan variants exist in adjacent feature folders and should be reconciled into `docs/plan/` over time
- grouped discovery for split related folders lives in `related_docs_index.md`

## Documentation Status

- This folder is valuable but fragmented
- It needs continued consolidation into clearer active docs plus feature-local history
- Historical residue should not be treated as the canonical implementation state without cross-checking the current codebase

