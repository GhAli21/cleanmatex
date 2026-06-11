export async function deregisterPush(
  deviceId: string,
  providerCode: 'VAPID' | 'FCM' | 'ONESIGNAL'
): Promise<void> {
  await fetch('/api/notifications/push-subscription', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, provider_code: providerCode }),
  });
}
