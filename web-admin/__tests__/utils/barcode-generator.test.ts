import { generateBarcode } from '@/lib/utils/barcode-generator';

describe('barcode-generator', () => {
  it('generates an SVG data URL', async () => {
    const dataUrl = await generateBarcode('ORD-20251025-0001-001');
    expect(dataUrl.startsWith('data:image/svg+xml;base64,')).toBeTruthy();
  });
});


