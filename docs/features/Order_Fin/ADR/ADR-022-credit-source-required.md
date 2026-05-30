# ADR-022 — Credit Application Source Reference Is Required

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

CUSTOMER_CREDIT redemption was dead code because payment leg schema had no source reference, causing undefined redemption reference.

---

## Decision

Every credit application leg must carry `creditType`, `sourceId`, and amount. Aliases such as giftCardId/walletId/creditReferenceId must normalize to sourceId.

---

## Rules / Implementation Notes

Missing source errors include CUSTOMER_CREDIT_REFERENCE_REQUIRED, GIFT_CARD_REFERENCE_REQUIRED, WALLET_REFERENCE_REQUIRED, CUSTOMER_ADVANCE_REFERENCE_REQUIRED, CREDIT_NOTE_REFERENCE_REQUIRED, and LOYALTY_CREDIT_REFERENCE_REQUIRED.

---

## Consequences

Positive: prevents undefined balance debit. Negative: UI/API schema must be updated.
