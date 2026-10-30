/**
 * P5-03e: a request line carries a catalog product or a custom item, never both, never neither.
 */
import { previewPaymentRequestSchema } from '@/lib/validations/new-order-payment-schemas';

const PRODUCT = '44444444-4444-4444-8444-444444444444';
const custom = { name: 'Wedding dress', unitPrice: 5 };
const parse = (line: Record<string, unknown>) => previewPaymentRequestSchema.safeParse({ items: [{ quantity: 1, ...line }] }).success;

describe('request line: product or custom item', () => {
  it.each([
    ['a product', { productId: PRODUCT }, true],
    ['a custom item', { customItem: custom }, true],
    ['both', { productId: PRODUCT, customItem: custom }, false],
    ['neither', {}, false],
    ['a custom item without a name', { customItem: { name: ' ', unitPrice: 5 } }, false],
  ])('%s', (_label, line, ok) => {
    expect(parse(line)).toBe(ok);
  });
});
