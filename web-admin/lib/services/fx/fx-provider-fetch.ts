/**
 * Secure fetch + parser registry for the tenant FX "From a provider URL"
 * adapter (plan 01 §7.1, 5E). R2 (SSRF): a tenant never supplies a URL —
 * only HQ-curated `sys_fx_provider_cd` rows are fetchable, and every one of
 * their `base_url`s is fixed, HQ-authored data, never tenant input. This
 * module enforces the remaining defenses in depth on top of that:
 *
 *   - HTTPS only.
 *   - The URL's host must literally be in the provider's `allowed_hosts`.
 *   - No redirects are ever followed (`redirect: 'error'`) — a redirect
 *     response throws instead of silently landing somewhere else.
 *   - A hard timeout and a hard response-size cap, enforced while streaming
 *     the body (never buffer an unbounded response).
 *
 * Only `sys_fx_provider_cd.auth_mode = 'NONE'` is implemented — the only
 * currently-active provider (`ECB_DAILY`) is keyless. `PLATFORM_KEY` rows
 * (`OPEN_EXCHANGE`, `FIXER`) stay `is_active = false` until their parser AND
 * key-handling both ship; `PARSER_REGISTRY` below is the actual gate (a
 * provider whose `parser_code` has no entry here can never be fetched,
 * regardless of its `is_active` flag — defense in depth on top of the DB
 * flag).
 *
 * The ECB parser is a narrow, bounded regex extractor, not a general XML
 * parser — deliberately: ECB's daily feed is a stable, simple, long-unchanged
 * public format, and not resolving DOCTYPE/ENTITY declarations at all (this
 * never attempts to) is a strictly smaller attack surface than pulling in a
 * full XML library capable of entity expansion (XXE). Any `<!DOCTYPE` or
 * `<!ENTITY` in the response is rejected outright before parsing, as a
 * sanity gate.
 */

import 'server-only';

import { TextDecoder } from 'util';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1024 * 1024; // 1 MiB — ECB's daily feed is a few KB; generous but bounded.

export interface FetchedProviderRates {
  /** The date the provider published these rates for (YYYY-MM-DD). */
  rateDate: string;
  /** Currency every rate is quoted against (e.g. EUR for ECB). */
  baseCurrencyCode: string;
  /** code -> "units of code per 1 unit of baseCurrencyCode", as the provider's own decimal text. */
  rates: Record<string, string>;
}

export class FxProviderFetchError extends Error {
  readonly code:
    | 'UNSUPPORTED_PROVIDER'
    | 'INVALID_URL'
    | 'DISALLOWED_HOST'
    | 'TIMEOUT'
    | 'RESPONSE_TOO_LARGE'
    | 'REDIRECT_BLOCKED'
    | 'FETCH_FAILED'
    | 'PARSE_FAILED';

  constructor(code: FxProviderFetchError['code'], message: string) {
    super(message);
    this.name = 'FxProviderFetchError';
    this.code = code;
  }
}

/** Parses ECB's `eurofxref-daily.xml` feed. Self-closing `<Cube currency='XXX' rate='1.2345'/>` elements only. */
function parseEcbDailyXml(xml: string): FetchedProviderRates {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new FxProviderFetchError('PARSE_FAILED', 'Response contains a DOCTYPE/ENTITY declaration — refused');
  }

  const dateMatch = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>/i);
  if (!dateMatch) {
    throw new FxProviderFetchError('PARSE_FAILED', 'Could not find the rate date in the ECB feed');
  }

  const rates: Record<string, string> = {};
  const rateRegex = /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9]+(?:\.[0-9]+)?)['"]\s*\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = rateRegex.exec(xml)) !== null) {
    rates[match[1].toUpperCase()] = match[2];
  }

  if (Object.keys(rates).length === 0) {
    throw new FxProviderFetchError('PARSE_FAILED', 'No currency rates found in the ECB feed');
  }

  return { rateDate: dateMatch[1], baseCurrencyCode: 'EUR', rates };
}

/** Keyed by `sys_fx_provider_cd.parser_code` — the authoritative gate on which providers are actually fetchable. */
const PARSER_REGISTRY: Record<string, (body: string) => FetchedProviderRates> = {
  ECB_DAILY_XML: parseEcbDailyXml,
};

export interface ProviderRow {
  code: string;
  baseUrl: string;
  allowedHosts: string[];
  authMode: string;
  parserCode: string;
}

/** Fetches and parses one curated provider's feed. Never accepts a caller-supplied URL. */
export async function fetchProviderRates(provider: ProviderRow): Promise<FetchedProviderRates> {
  const parser = PARSER_REGISTRY[provider.parserCode];
  if (!parser) {
    throw new FxProviderFetchError('UNSUPPORTED_PROVIDER', `No parser implemented for ${provider.parserCode}`);
  }
  if (provider.authMode !== 'NONE') {
    throw new FxProviderFetchError('UNSUPPORTED_PROVIDER', `Auth mode ${provider.authMode} is not implemented yet`);
  }

  let url: URL;
  try {
    url = new URL(provider.baseUrl);
  } catch {
    throw new FxProviderFetchError('INVALID_URL', `Provider ${provider.code} has an unparseable base_url`);
  }
  if (url.protocol !== 'https:') {
    throw new FxProviderFetchError('INVALID_URL', `Provider ${provider.code}'s base_url must be HTTPS`);
  }
  if (!provider.allowedHosts.includes(url.hostname)) {
    throw new FxProviderFetchError('DISALLOWED_HOST', `Host ${url.hostname} is not in provider ${provider.code}'s allowlist`);
  }

  const body = await fetchWithCaps(url);
  try {
    return parser(body);
  } catch (error) {
    if (error instanceof FxProviderFetchError) throw error;
    throw new FxProviderFetchError('PARSE_FAILED', error instanceof Error ? error.message : 'Failed to parse provider response');
  }
}

async function fetchWithCaps(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, redirect: 'error' });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new FxProviderFetchError('TIMEOUT', `Request to ${url.hostname} timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    // fetch() rejects for a blocked redirect when redirect: 'error' is set.
    const message = error instanceof Error ? error.message : String(error);
    if (/redirect/i.test(message)) {
      throw new FxProviderFetchError('REDIRECT_BLOCKED', `${url.hostname} attempted a redirect — refused`);
    }
    throw new FxProviderFetchError('FETCH_FAILED', `Failed to reach ${url.hostname}: ${message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new FxProviderFetchError('FETCH_FAILED', `${url.hostname} responded with HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new FxProviderFetchError('FETCH_FAILED', `${url.hostname} returned an empty response`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let received = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_RESPONSE_BYTES) {
        throw new FxProviderFetchError('RESPONSE_TOO_LARGE', `${url.hostname} response exceeded ${MAX_RESPONSE_BYTES} bytes`);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return text;
}
