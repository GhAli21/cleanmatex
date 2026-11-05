import { generateBarcode } from '@/lib/utils/barcode-generator';
import { renderCode128DataUrl } from '@/lib/utils/barcode/code128';
import * as legacy from '@/lib/utils/barcode-generator';

describe('barcode-generator (deprecated shim)', () => {
  it('returns a real CODE128 SVG data URL for the code as-is', async () => {
    const dataUrl = await generateBarcode('ORD-20251025-0001-001');
    expect(dataUrl.startsWith('data:image/svg+xml')).toBeTruthy();
    expect(dataUrl).toBe(renderCode128DataUrl('ORD-20251025-0001-001'));
  });

  it('no longer exports the JSON QR helpers (D3)', () => {
    expect(Object.keys(legacy)).toEqual(['generateBarcode']);
  });
});
