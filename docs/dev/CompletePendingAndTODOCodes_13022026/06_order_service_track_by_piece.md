# 06 - Order Service Track By Piece

## Summary

Removed testing override `|| true` so piece creation respects the `USE_TRACK_BY_PIECE` tenant setting.

## File(s) Affected

- `web-admin/lib/services/order-service.ts`

## Issue

`if (trackByPiece || true)` forced piece creation for every order regardless of tenant setting.

## Code Before

```typescript
          if (trackByPiece || true) { // TODO: Remove true after testing
```

## Code After

```typescript
          if (trackByPiece) {
```

## Effects

- Order items without `USE_TRACK_BY_PIECE` enabled will no longer create pieces automatically
- Tenants can control piece-level tracking via settings

## Testing

1. Tenant with `USE_TRACK_BY_PIECE` = true: pieces created
2. Tenant with `USE_TRACK_BY_PIECE` = false: no pieces created
