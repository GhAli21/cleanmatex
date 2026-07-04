# ADR-021 — MOBILE_PAYMENT Is a Real External Payment Method

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Mobile payment can be confused with internal wallet.

---

## Decision

`MOBILE_PAYMENT` means external real payment through phone/payment app/QR/NFC/provider rail. It belongs to real payment legs and `org_order_payments_dtl`.

---

## Rules / Implementation Notes

Internal `WALLET` is a credit application, not `MOBILE_PAYMENT`.

---

## Consequences

Positive: avoids wallet/mobile confusion. Negative: UI/payment config must label internal wallet separately.
