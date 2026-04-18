# CleanMateX Customer App — AI Implementation Rules

## Scope
This app is for customers.

Main flows include:
- authentication
- profile management
- addresses
- service browsing
- cart/order creation
- pickup and delivery scheduling
- order tracking
- payments
- receipts
- notifications
- loyalty, wallet, promotions when enabled

## UX Priorities
- make flows simple and confidence-building
- reduce friction in onboarding and checkout
- preserve incomplete input if app/network fails
- make order status very clear
- optimize for Arabic and English equally
- keep forms compact and understandable

## Technical Rules
- Use shared core widgets and theme
- Use Riverpod for state
- Use repositories for all data access
- Use explicit manual models and serializers
- Handle logged-out, loading, empty, and failed states properly
- Respect feature flags and plan-based feature availability
- Assume some users are low-tech and need clarity

## Do Not
- overwhelm the customer with operational detail
- expose staff or admin-only concepts
- assume perfect connectivity
- hardcode prices, currencies, or strings
- use hidden generated code