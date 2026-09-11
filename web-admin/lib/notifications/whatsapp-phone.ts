/**
 * Choose the WhatsApp destination number from sandbox override vs contacts.
 */

/** Strip a whatsapp: prefix so E.164 and Twilio sandbox forms compare the same. */
export function stripWhatsAppPrefix(raw: string): string {
  return raw.replace(/^whatsapp:/i, '').trim()
}

/**
 * Prefer the customer master phone; fall back to the order-level contact
 * POS stores on org_orders_mst when the master row has no number.
 * @param customerPhone org_customers_mst.phone
 * @param orderMobile org_orders_mst.customer_mobile_number
 */
export function pickWhatsAppPhone(
  customerPhone: string | null | undefined,
  orderMobile: string | null | undefined,
): string | null {
  return customerPhone?.trim() || orderMobile?.trim() || null
}

/**
 * Sandbox override first (joined Twilio number), then customer, then order mobile.
 * Empty sandboxTo keeps production routing.
 * @param sandboxTo wa_sandbox_to_phone / TWILIO_WHATSAPP_SANDBOX_TO
 * @param customerPhone org_customers_mst.phone
 * @param orderMobile org_orders_mst.customer_mobile_number
 */
export function pickWhatsAppDestination(
  sandboxTo: string | null | undefined,
  customerPhone: string | null | undefined,
  orderMobile: string | null | undefined,
): string | null {
  const override = sandboxTo?.trim()
  if (override) return stripWhatsAppPrefix(override)
  const picked = pickWhatsAppPhone(customerPhone, orderMobile)
  return picked ? stripWhatsAppPrefix(picked) : null
}
