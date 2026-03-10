# Digital Receipts

**Status:** Implemented feature summary available; current code alignment should still be verified when extending  
**Last Updated:** 2026-03-10

## Overview

This feature covers receipt generation, delivery-channel tracking, bilingual receipt templates, WhatsApp delivery support, QR code generation, and receipt retrieval/resend flows.

## Current Documentation Reality

The main implementation detail currently lives in `IMPLEMENTATION_SUMMARY.md`. This README was previously a placeholder and did not reflect the actual documented implementation status.

## Most Relevant File

- `IMPLEMENTATION_SUMMARY.md`

## Documented Implemented Scope

Based on the implementation summary, this feature includes:

- receipt schema and delivery tracking tables
- bilingual receipt templates
- receipt service and template generation
- WhatsApp client integration and webhook handling
- receipt API routes
- frontend hooks for receipt retrieval and sending
- QR-code utility support

## Related Documentation

- `IMPLEMENTATION_SUMMARY.md`
- `../../plan/master_plan_cc_01.md`
- related order and customer docs under `../`

## Notes

- Treat the implementation summary as the main historical implementation reference in this folder
- If the feature is extended, update this README and the implementation summary together so they stay compatible

