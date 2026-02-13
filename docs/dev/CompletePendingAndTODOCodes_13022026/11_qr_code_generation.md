# 11 - QR Code Generation

## Summary

Integrated `qrcode` package to generate actual QR code images (data URLs) instead of returning plain URLs.

## File(s) Affected

- `web-admin/lib/utils/qr-code-generator.ts`

## Issue

Functions returned tracking URLs only; no QR image was generated.

## Code Before

```typescript
    // TODO: Use qrcode library to generate actual QR code image
    return trackingUrl;
```

## Code After

```typescript
import QRCode from 'qrcode';

    const dataUrl = await QRCode.toDataURL(trackingUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    return dataUrl;
```

## Effects

- Returns `data:image/png;base64,...` suitable for `<img src={dataUrl} />`
- Receipt service and PDF generation can embed QR codes directly
- `qrcode` package already in package.json

## Testing

1. Call `generateQRCode('ORD-001', tenantId)` - should return data URL
2. Use in `<img src={qrDataUrl} />` - should render QR code
