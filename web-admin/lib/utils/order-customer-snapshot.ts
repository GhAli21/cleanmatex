/**
 * Order header customer fields are a snapshot at create / last explicit edit.
 * Live customer-master values must not overwrite them as a side effect of save.
 */

export function normalizeCustomerSnapshotText(value: unknown): string {
  return String(value ?? '').trim();
}

export function customerSnapshotFieldChanged(next: unknown, original: unknown): boolean {
  return normalizeCustomerSnapshotText(next) !== normalizeCustomerSnapshotText(original);
}

export function serializeOrderCustomerSnapshot(order: {
  customer_name?: string | null;
  customer_mobile_number?: string | null;
  customer_mobile?: string | null;
  customer_email?: string | null;
}): {
  customer_name: string | null;
  customer_mobile: string | null;
  customer_email: string | null;
} {
  return {
    customer_name: order.customer_name ?? null,
    customer_mobile: order.customer_mobile_number ?? order.customer_mobile ?? null,
    customer_email: order.customer_email ?? null,
  };
}

export function pickChangedCustomerSnapshot(input: {
  nextName?: string;
  nextMobile?: string;
  nextEmail?: string;
  originalName?: unknown;
  originalMobile?: unknown;
  originalEmail?: unknown;
}): {
  customerName?: string;
  customerMobile?: string;
  customerEmail?: string;
} {
  const out: {
    customerName?: string;
    customerMobile?: string;
    customerEmail?: string;
  } = {};

  if (input.nextName && customerSnapshotFieldChanged(input.nextName, input.originalName)) {
    out.customerName = input.nextName;
  }
  if (input.nextMobile && customerSnapshotFieldChanged(input.nextMobile, input.originalMobile)) {
    out.customerMobile = input.nextMobile;
  }
  if (input.nextEmail && customerSnapshotFieldChanged(input.nextEmail, input.originalEmail)) {
    out.customerEmail = input.nextEmail;
  }

  return out;
}
