/**
 * Tests: fx-provider-fetch (secure fetch + ECB parser, plan 01 §7.1, 5E).
 * Covers the SSRF-defense surface (HTTPS, host allowlist, no redirects,
 * timeout, size cap) and the ECB XML parser (happy path + malicious input).
 */

import { TextEncoder } from 'util';
import { fetchProviderRates, FxProviderFetchError, type ProviderRow } from '@/lib/services/fx/fx-provider-fetch';

const ECB_PROVIDER: ProviderRow = {
  code: 'ECB_DAILY',
  baseUrl: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
  allowedHosts: ['www.ecb.europa.eu'],
  authMode: 'NONE',
  parserCode: 'ECB_DAILY_XML',
};

const SAMPLE_ECB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <Cube>
    <Cube time='2026-09-30'>
      <Cube currency='USD' rate='1.0890'/>
      <Cube currency='JPY' rate='160.44'/>
      <Cube currency='GBP' rate='0.8601'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

function mockFetchOnce(body: string, init: { ok?: boolean; status?: number } = {}) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(body);
  let sent = false;
  const stream = {
    getReader: () => ({
      read: async () => {
        if (sent) return { done: true, value: undefined };
        sent = true;
        return { done: false, value: bytes };
      },
      releaseLock: () => {},
    }),
  };
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    body: stream,
  });
}

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('fx-provider-fetch — security guards', () => {
  it('rejects a non-HTTPS base_url', async () => {
    await expect(fetchProviderRates({ ...ECB_PROVIDER, baseUrl: 'http://www.ecb.europa.eu/x.xml' })).rejects.toMatchObject({
      code: 'INVALID_URL',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a host not in the provider allowlist', async () => {
    await expect(
      fetchProviderRates({ ...ECB_PROVIDER, baseUrl: 'https://evil.example.com/x.xml' })
    ).rejects.toMatchObject({ code: 'DISALLOWED_HOST' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a provider whose parser is not implemented (the real gate, not just is_active)', async () => {
    await expect(
      fetchProviderRates({ ...ECB_PROVIDER, parserCode: 'OPEN_EXCHANGE_JSON' })
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_PROVIDER' });
  });

  it('rejects an auth_mode other than NONE', async () => {
    await expect(fetchProviderRates({ ...ECB_PROVIDER, authMode: 'PLATFORM_KEY' })).rejects.toMatchObject({
      code: 'UNSUPPORTED_PROVIDER',
    });
  });

  it('calls fetch with redirect: "error" so a redirect response is refused, not followed', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('unexpected redirect'));
    await expect(fetchProviderRates(ECB_PROVIDER)).rejects.toMatchObject({ code: 'REDIRECT_BLOCKED' });
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(callArgs.redirect).toBe('error');
  });

  it('surfaces a non-2xx response as FETCH_FAILED', async () => {
    mockFetchOnce('', { ok: false, status: 503 });
    await expect(fetchProviderRates(ECB_PROVIDER)).rejects.toMatchObject({ code: 'FETCH_FAILED' });
  });

  it('aborts and throws RESPONSE_TOO_LARGE when the body exceeds the size cap', async () => {
    const huge = 'x'.repeat(2 * 1024 * 1024); // 2 MiB > 1 MiB cap
    mockFetchOnce(huge);
    await expect(fetchProviderRates(ECB_PROVIDER)).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
  });
});

describe('fx-provider-fetch — ECB parser', () => {
  it('parses the rate date, base currency, and every currency/rate pair', async () => {
    mockFetchOnce(SAMPLE_ECB_XML);
    const result = await fetchProviderRates(ECB_PROVIDER);
    expect(result.rateDate).toBe('2026-09-30');
    expect(result.baseCurrencyCode).toBe('EUR');
    expect(result.rates).toEqual({ USD: '1.0890', JPY: '160.44', GBP: '0.8601' });
  });

  it('refuses a response containing a DOCTYPE declaration (defense in depth, not a real XML parser)', async () => {
    const malicious = `<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>${SAMPLE_ECB_XML}`;
    mockFetchOnce(malicious);
    await expect(fetchProviderRates(ECB_PROVIDER)).rejects.toMatchObject({ code: 'PARSE_FAILED' });
  });

  it('throws PARSE_FAILED when the feed has no recognizable rate date', async () => {
    mockFetchOnce('<Cube><Cube currency="USD" rate="1.09"/></Cube>');
    await expect(fetchProviderRates(ECB_PROVIDER)).rejects.toMatchObject({ code: 'PARSE_FAILED' });
  });

  it('throws PARSE_FAILED when the feed has a date but no currency rates', async () => {
    mockFetchOnce("<Cube><Cube time='2026-09-30'></Cube></Cube>");
    await expect(fetchProviderRates(ECB_PROVIDER)).rejects.toMatchObject({ code: 'PARSE_FAILED' });
  });
});

describe('fx-provider-fetch — FxProviderFetchError', () => {
  it('is distinguishable from a generic Error by instanceof', () => {
    const err = new FxProviderFetchError('TIMEOUT', 'x');
    expect(err instanceof FxProviderFetchError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});
