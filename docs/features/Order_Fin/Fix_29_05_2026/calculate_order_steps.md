1. Core principle

The system must calculate in this order:

1. Build order value
2. Apply commercial discounts/promotions
3. Calculate tax
4. Calculate final sale total
5. Apply completed real payments
6. Apply stored-value/customer-credit applications
7. Track pending payments separately
8. Calculate outstanding / overpaid
9. Classify outstanding as pay-on-collection or AR receivable
10. Create/update AR invoice only for receivable cases
11. Create/update tax document separately
12. Reconcile and warn if mismatch

The most important rule:

Order Total is the sale value.
Payments and credits do not reduce Order Total.
Payments and credits reduce Outstanding Balance.
