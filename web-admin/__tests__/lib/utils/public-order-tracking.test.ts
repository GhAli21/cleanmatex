import {
  buildAbsolutePublicTrackingUrl,
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

    it('BF-16: no longer offers a readable /public/orders path builder', async () => {
      const utils = await import('@/lib/utils/public-order-tracking');
      expect('buildLegacyPublicTrackingPath' in utils).toBe(false);
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
