# Delivery & Logistics - Development Plan & PRD

**Document ID**: 014  
**Version**: 1.0  
**Dependencies**: 001-013  
**Related Requirements**: FR-DRV-001, UC08

---

## Overview

Implement route management, driver assignment, and Proof of Delivery (POD) via OTP/signature/photo with retry handling.

## Functional Requirements

### FR-DEL-001: Route Management

- Create delivery routes
- Assign drivers
- Optimize stop sequence
- Batch orders by area
- Route status tracking

### FR-DEL-002: Driver Assignment

- Available driver list
- Workload balancing
- Multi-route support
- Driver notifications

### FR-DEL-003: Proof of Delivery (POD)

- **OTP**: 4-digit code verification
- **Signature**: Digital signature capture
- **Photo**: Delivery photo evidence
- POD required per policy
- Retry handling for failed delivery

### FR-DEL-004: Delivery Tracking

- Real-time location (GPS)
- ETA calculation
- Customer notifications
- Status updates

## Technical Design

Uses existing:

- `org_delivery_routes_mst`
- `org_delivery_stops_dtl`

### POD Capture

```typescript
async function capturePOD(
  stopId: string,
  podData: {
    method: "otp" | "signature" | "photo";
    otp?: string;
    signature?: string;
    photo?: File;
  }
): Promise<void> {
  const stop = await getDeliveryStop(stopId);

  // Validate POD based on method
  if (podData.method === "otp") {
    const validOTP = await validateOTP(stop.order_id, podData.otp);
    if (!validOTP) throw new Error("Invalid OTP");
  }

  // Update stop status
  await db.update("org_delivery_stops_dtl", {
    where: { id: stopId },
    data: {
      status: "completed",
      actual_time: new Date(),
      pod_method: podData.method,
      pod_data: podData,
    },
  });

  // Update order status
  await transitionOrder(stop.order_id, "delivered", {
    userId: stop.driver_id,
    metadata: { pod: podData },
  });

  // Notify customer
  await sendDeliveryNotification(stop.order_id, "delivered");
}
```

## API Endpoints

```typescript
// Routes
POST   /api/v1/routes                    // Create route
GET    /api/v1/routes/:id                // Get route
PATCH  /api/v1/routes/:id                // Update route
POST   /api/v1/routes/:id/assign         // Assign driver
POST   /api/v1/routes/:id/optimize       // Optimize stops

// Delivery
POST   /api/v1/delivery/:stopId/pod      // Capture POD
POST   /api/v1/delivery/:stopId/fail     // Mark failed
GET    /api/v1/delivery/driver/:id       // Driver routes
POST   /api/v1/delivery/location         // Update GPS location
```

## Implementation (5 days)

1. Route management (2 days)
2. Driver assignment (1 day)
3. POD capture (2 days)
4. GPS tracking (optional, 2 days)

## Success Metrics

- OTP POD adoption: ≥ 95%
- Failed delivery rate: < 5%
- Average delivery time: Track baseline

## Acceptance Checklist

- [ ] Route creation working
- [ ] Driver assignment
- [ ] OTP POD capture
- [ ] Signature POD capture
- [ ] Photo POD capture
- [ ] Failed delivery handling
- [ ] Customer notifications

---

**Last Updated**: 2025-10-09
