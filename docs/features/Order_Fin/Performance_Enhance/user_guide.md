# Payment preparation user guide

Status: **future expected behavior, pending implementation and release verification**. This guide explains the intended cashier experience after the approved performance work. It does not announce deployed features or measured opening speeds. Wording below describes behavior, not newly shipped button labels.

See [cashier flow diagrams](user_guide_mermaid.md). Existing payment preparation already calculates totals on the server and provides failure recovery; the enhancements aim to reduce repeated work and unnecessary waiting while preserving review of money.

## Opening payment

Add the required order items and choose the correct branch/customer before opening payment. The payment window should appear promptly and keep its Cancel action available while preparation runs, except during an actual protected submission.

For a first opening, a preparation state remains visible until the organization currency and current financial information have been verified. The intended improvement prepares suitable payment configuration in parallel, so the cashier does not wait through avoidable successive loading stages.

For a later opening with unchanged inputs, a future display cache may show the previously calculated numbers immediately. Those numbers must visibly remain under refresh until the current quote is usable. A visible cached amount is not confirmation that payment can be posted. Immediate authoritative reuse is a separate design item and is not available merely because an amount appears quickly.

## Choosing a payment method

Methods are offered for the current order amount and customer context. A cash method may require an active linked drawer/POS session; a terminal-based method may require a configured available terminal. Prepare or recover the required operational setup using the established session workflow.

An unavailable optional lookup should not block every method. The intended UI explains which method is affected and offers the relevant recovery. It must never silently choose an unauthorized drawer or bypass a required session.

## Changing the order or discounts

When a financial input changes, the intended UI preserves entered payment amounts and selections while recalculating. Submission remains unavailable until the new calculation is ready. Rapid edits should produce one useful refresh after the cashier pauses, and an older reply must never replace the newer order calculation.

If a new total, balance, or method rule makes an entered amount invalid, the UI should explain the problem beside the affected area and let the cashier correct it. Refreshing, switching Simple/Advanced presentation, or closing a dialog must not silently rewrite money.

## Reviewing and submitting

Review the total, the amount being settled now, any change, and the remaining balance before confirming. Current source binds confirmation to the client snapshot being reviewed. The proposed enhancement also validates the reviewed server financial facts at submission and protects retries against duplicate posting.

If prices, taxes, balances, eligibility, or another relevant fact changes before the write completes, the proposed flow stops that attempt and refreshes the explanation in the same payment window. Entered amounts should remain available for correction. The cashier must review and confirm again; the system must not silently accept a changed total.

This structured in-place mismatch flow is **planned**, not an existing guarantee for every create/edit submission path.

## Loading, errors, and recovery

- If preparation is still running, wait for the current calculation or cancel to return to the order.
- If preparation fails, use the offered Retry action after connectivity or setup is restored. A failed refresh must not leave a previously cached figure available for posting.
- If the organization currency is missing or cannot be verified, money entry remains blocked. Use the existing currency-configuration recovery and retry after an authorized administrator fixes the setup. The application must not invent a replacement currency.
- If the sign-in context is unavailable, use the existing sign-out/sign-in recovery. A previous cashier's balances or cached quote must not appear as the new cashier's authorized data.
- If a required drawer, POS session, or terminal is unavailable, resolve that requirement through its established workflow or select another eligible method when permitted.

## English, Arabic, and accessibility

All released feedback must have matching English and Arabic translations and support right-to-left layout. Currency, precision, and rounding come from verified organization configuration. Loading and refresh state must be understandable through text and assistive technology, not color or a spinner alone. Focus should remain useful after Retry, failed confirmation, and in-place changes.

New explanatory copy and the final visual treatment remain implementation and UI verification tasks. The guide does not claim that the proposed refresh or mismatch messages already exist in either language.
