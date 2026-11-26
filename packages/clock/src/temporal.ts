/**
 * The Temporal adapter (D1). THE ONLY file in the repository that imports `temporal-polyfill`
 * or reads the `Temporal` global. Everything else in `@cmx/clock` calls {@link temporal}.
 *
 * Native `globalThis.Temporal` wins when the runtime ships it; otherwise the MIT polyfill is used.
 * No `Temporal.*` object leaves this package: the public API speaks `Date`, branded strings and
 * plain objects only.
 *
 * Removal plan (D1): once every supported browser and the Node LTS in use ship Temporal
 * unflagged, make {@link temporal} return the native object only, delete the dependency,
 * and run the shared vectors.
 */
import { Temporal as PolyfillTemporal } from 'temporal-polyfill';

/** The Temporal namespace shape this package relies on. */
export type TemporalApi = typeof PolyfillTemporal;

/** Which implementation answered. */
export type TemporalSource = 'native' | 'polyfill';

function nativeTemporal(): TemporalApi | undefined {
  const candidate = (globalThis as { Temporal?: TemporalApi }).Temporal;
  return candidate && typeof candidate.Instant === 'function' ? candidate : undefined;
}

let override: { api: TemporalApi; source: TemporalSource } | null = null;

/** The Temporal namespace in use: native when present, otherwise the polyfill. */
export function temporal(): TemporalApi {
  if (override) return override.api;
  return nativeTemporal() ?? PolyfillTemporal;
}

/** `native` when the runtime ships Temporal, otherwise `polyfill`. */
export function temporalSource(): TemporalSource {
  if (override) return override.source;
  return nativeTemporal() ? 'native' : 'polyfill';
}

/**
 * Tests only: force an implementation so the shared vectors can prove that the native and the
 * polyfill adapters agree. Pass `null` to restore the automatic choice.
 */
export function __setTemporalForTests(api: TemporalApi | null, source: TemporalSource = 'native'): void {
  override = api ? { api, source } : null;
}

/** Tests only: the bundled polyfill namespace, used to simulate a native runtime. */
export function __polyfillTemporalForTests(): TemporalApi {
  return PolyfillTemporal;
}
