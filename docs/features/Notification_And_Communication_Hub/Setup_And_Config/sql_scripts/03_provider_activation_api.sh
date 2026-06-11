#!/usr/bin/env bash
# =============================================================================
# CMX-PRD-019 — Provider Activation via REST API
# =============================================================================
# Alternative to 02_activate_providers_and_channels.sql — uses the live API
# instead of direct DB inserts. Requires the app to be running and you to
# be authenticated (provide your session Bearer token).
#
# USAGE:
#   1. Log into the web-admin app, open DevTools > Application > Cookies,
#      copy the session value, then set it as the AUTH_TOKEN below.
#   2. Set BASE_URL to your deployment URL.
#   3. Fill in provider-specific values for each channel you want to enable.
#   4. Run: bash 03_provider_activation_api.sh
# =============================================================================

BASE_URL="https://cmx.cleanmatex.com"
AUTH_TOKEN="__YOUR_SESSION_TOKEN_HERE__"

H_AUTH="Authorization: Bearer $AUTH_TOKEN"
H_JSON="Content-Type: application/json"

# ─────────────────────────────────────────────────────────────────────────────
# IN_APP — no external provider, enable channel only
# ─────────────────────────────────────────────────────────────────────────────
echo "Enabling IN_APP channel..."
curl -s -X PUT "$BASE_URL/api/v1/notifications/settings" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d '{"channel_code":"IN_APP","is_enabled":true,"quiet_hours_enabled":false}' | jq .


# ─────────────────────────────────────────────────────────────────────────────
# EMAIL — Resend
# ─────────────────────────────────────────────────────────────────────────────
echo "Registering EMAIL provider (Resend)..."
curl -s -X POST "$BASE_URL/api/v1/notifications/settings/providers" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d '{
    "channel_code": "EMAIL",
    "provider_code": "RESEND",
    "display_name": "Resend",
    "config": {
      "from_email": "noreply@cmx.cleanmatex.com",
      "from_name": "CleanMateX"
    }
  }' | jq .

echo "Activating Resend for EMAIL..."
curl -s -X PUT "$BASE_URL/api/v1/notifications/settings/providers" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d '{"channel_code":"EMAIL","provider_code":"RESEND"}' | jq .

echo "Enabling EMAIL channel..."
curl -s -X PUT "$BASE_URL/api/v1/notifications/settings" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d '{"channel_code":"EMAIL","is_enabled":true,"quiet_hours_enabled":false}' | jq .


# ─────────────────────────────────────────────────────────────────────────────
# SMS — Twilio (uncomment and fill values after setting TWILIO_* env vars)
# ─────────────────────────────────────────────────────────────────────────────
# TWILIO_FROM="+1XXXXXXXXXX"
#
# echo "Registering SMS provider (Twilio)..."
# curl -s -X POST "$BASE_URL/api/v1/notifications/settings/providers" \
#   -H "$H_AUTH" -H "$H_JSON" \
#   -d "{
#     \"channel_code\": \"SMS\",
#     \"provider_code\": \"TWILIO_SMS\",
#     \"display_name\": \"Twilio SMS\",
#     \"config\": { \"from_number\": \"$TWILIO_FROM\" }
#   }" | jq .
#
# curl -s -X PUT "$BASE_URL/api/v1/notifications/settings/providers" \
#   -H "$H_AUTH" -H "$H_JSON" \
#   -d '{"channel_code":"SMS","provider_code":"TWILIO_SMS"}' | jq .
#
# curl -s -X PUT "$BASE_URL/api/v1/notifications/settings" \
#   -H "$H_AUTH" -H "$H_JSON" \
#   -d '{"channel_code":"SMS","is_enabled":true,"quiet_hours_enabled":true,"quiet_hours_start":"22:00","quiet_hours_end":"08:00","quiet_hours_tz":"Asia/Dubai"}' | jq .


# ─────────────────────────────────────────────────────────────────────────────
# WHATSAPP — Twilio BSP (uncomment after template approval)
# ─────────────────────────────────────────────────────────────────────────────
# TWILIO_WA_FROM="+1XXXXXXXXXX"
#
# curl -s -X POST "$BASE_URL/api/v1/notifications/settings/providers" \
#   -H "$H_AUTH" -H "$H_JSON" \
#   -d "{
#     \"channel_code\": \"WHATSAPP\",
#     \"provider_code\": \"TWILIO_WHATSAPP\",
#     \"display_name\": \"WhatsApp via Twilio\",
#     \"config\": { \"from_number\": \"whatsapp:$TWILIO_WA_FROM\" }
#   }" | jq .
#
# curl -s -X PUT "$BASE_URL/api/v1/notifications/settings/providers" \
#   -H "$H_AUTH" -H "$H_JSON" \
#   -d '{"channel_code":"WHATSAPP","provider_code":"TWILIO_WHATSAPP"}' | jq .


# ─────────────────────────────────────────────────────────────────────────────
# PUSH — VAPID (uncomment after deploying sw.js and NEXT_PUBLIC_VAPID_PUBLIC_KEY)
# ─────────────────────────────────────────────────────────────────────────────
# VAPID_PUB="BKug-WOexd_dskGfX9LRYcN2BEhFvT6c1ZpuvudND4wXxHrEoUBOJsiJqVq8QT0H6ncM9On5tnwyMsT2BqQfgrQ"
#
# curl -s -X POST "$BASE_URL/api/v1/notifications/settings/providers" \
#   -H "$H_AUTH" -H "$H_JSON" \
#   -d "{
#     \"channel_code\": \"PUSH\",
#     \"provider_code\": \"VAPID\",
#     \"display_name\": \"Browser Web Push (VAPID)\",
#     \"config\": { \"vapid_public_key\": \"$VAPID_PUB\" }
#   }" | jq .
#
# curl -s -X PUT "$BASE_URL/api/v1/notifications/settings/providers" \
#   -H "$H_AUTH" -H "$H_JSON" \
#   -d '{"channel_code":"PUSH","provider_code":"VAPID"}' | jq .
#
# curl -s -X PUT "$BASE_URL/api/v1/notifications/settings" \
#   -H "$H_AUTH" -H "$H_JSON" \
#   -d '{"channel_code":"PUSH","is_enabled":true,"quiet_hours_enabled":false}' | jq .

echo ""
echo "Done. Verify channel state:"
curl -s -X GET "$BASE_URL/api/v1/notifications/settings" -H "$H_AUTH" | jq .
