# Rack & Bags Modal — PRD

**Project:** CleanMateX Tenant App
**Last Updated:** 2026-09-11

## Problem

On the Ready Details screen, "Make available for pickup" is correctly disabled when `rack_location` isn't set (`GATE_RACK_REQUIRED`), but the disabled state isn't visually distinct enough, and unblocking it requires a separate rack card + "Save rack" round-trip before the button works.

Rack entry was duplicated three ways in the codebase: a bespoke card on Ready Details, a section inside the Processing modal, and a generic single-field inline prompt inside `WorkflowActionBar`.

## Decision

Build one reusable **Rack & Bags modal** (rack, locker + code, bags count, hanging count, plus a "customer has orders on rack(s)" cross-order conflict banner), matching the owner-supplied mockup. Wire it into `WorkflowActionBar`'s existing `GATE_RACK_REQUIRED` handling — since `WorkflowActionBar` already mounts on `ready`, `qa`, `packing`, `processing`, `assembly`, `preparation`, `order-actions`, `home-collection`, and `delivery` screens, this rolls the fix out everywhere immediately, not just Ready Details. The Ready Details bespoke "Make available for pickup" button (which hides its release actions from `WorkflowActionBar`) reuses the same modal and a newly-extracted shared `isOnlyRackBlocked` helper.

## Scope (v1)

All fields fully functional: rack, locker, code, bag count, hanging count. Cross-order rack-conflict banner included as real functionality, not a stub. `locker_location`, `locker_code`, `hanging_count` are net-new columns on `org_orders_mst` (via migration); `rack_location`/`bag_count` already existed.

## Out of scope

New RBAC permission (existing `orders:update`/`orders:transition` cover it), applying the migration (created only, user applies), editing `bag_count` at Quick Drop intake beyond making it also editable here, and consolidating the Processing modal's own denser piece-level rack section.

## Reference

Full phase-by-phase implementation plan: `C:\Users\JHNLP\.claude\plans\starry-seeking-nebula.md` (harness-local, not checked into the repo).
