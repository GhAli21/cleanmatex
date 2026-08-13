import {
  buildAbsolutePublicTrackingUrl,
  buildLegacyPublicTrackingPath,
  buildPublicTrackingPath,
  normalizePublicTrackingToken,
} from '@/lib/utils/public-order-tracking';

describe('public-order-tracking utils', () => {
  describe('normalizePublicTrackingToken', () => {
    it('trims and lowercases a valid token', () => {
      expect(normalizePublicTrackingToken('  ABCD-1234_token_x  ')).toBe('abcd-1234_token_x');
    });

    it('returns null for invalid token shapes', () => {
      expect(normalizePublicTrackingToken('short')).toBeNull();
      expect(normalizePublicTrackingToken('bad token with spaces')).toBeNull();
      expect(normalizePublicTrackingToken('token/with/slash')).toBeNull();
    });
  });

  describe('path builders', () => {
    it('builds the opaque tracking path', () => {
      expect(buildPublicTrackingPath('abc/123')).toBe('/track/abc%2F123');
    });

    it('builds the legacy readable tracking path', () => {
      expect(
        buildLegacyPublicTrackingPath(
          '11111111-1111-1111-1111-111111111111',
          'ORD-20260725/0004',
        ),
      ).toBe('/public/orders/11111111-1111-1111-1111-111111111111/ORD-20260725%2F0004');
    });

    it('builds an absolute URL without double slashes', () => {
      expect(buildAbsolutePublicTrackingUrl('https://cmx.cleanmatex.com/', '/track/opaque-token')).toBe(
        'https://cmx.cleanmatex.com/track/opaque-token',
      );
      expect(buildAbsolutePublicTrackingUrl('https://cmx.cleanmatex.com', 'track/opaque-token')).toBe(
        'https://cmx.cleanmatex.com/track/opaque-token',
      );
    });
  });
});
