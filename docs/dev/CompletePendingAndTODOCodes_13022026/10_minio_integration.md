# 10 - MinIO Integration

## Summary

Implemented actual MinIO upload and delete in `upload-photo.ts`. When MinIO env vars are configured, uses real storage; otherwise falls back to mock URLs for dev.

## File(s) Affected

- `web-admin/lib/storage/upload-photo.ts`

## Issue

Placeholder returned mock URLs; no actual file storage.

## Code Before

```typescript
    // TODO: Upload to MinIO
    const mockUrl = `...`;
    return { success: true, url: mockUrl };
```

## Code After

```typescript
import { Client } from 'minio';

function getMinioClient(): Client | null {
  const endpoint = process.env.MINIO_ENDPOINT;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  if (!endpoint || !accessKey || !secretKey) return null;
  return new Client({ endPoint: endpoint, port, useSSL, accessKey, secretKey });
}

if (client) {
  await client.putObject(bucket, key, buffer, file.size, { 'Content-Type': file.type });
  const url = await client.presignedGetObject(bucket, key, 24 * 60 * 60);
  return { success: true, url };
}
// Fallback: mock URL when MinIO not configured
return { success: true, url: mockUrl };
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| MINIO_ENDPOINT | MinIO server host |
| MINIO_PORT | Port (default 9000) |
| MINIO_USE_SSL | 'true' for HTTPS |
| MINIO_ACCESS_KEY | Access key |
| MINIO_SECRET_KEY | Secret key |
| MINIO_BUCKET | Bucket name (default: cleanmatex) |

## Effects

- Production: real MinIO when configured
- Dev: mock URLs when not configured (no breaking change)
- Presigned URLs for secure access (24h expiry)

## Testing

1. Without MinIO env: should return mock URL
2. With MinIO env: should upload and return presigned URL
