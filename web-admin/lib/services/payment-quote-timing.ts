import 'server-only';

/** Request-local timings contain stage names and durations, never customer or payment data. */
export class PaymentQuoteTiming {
  private readonly durations: Record<string, number> = {};

  /**
   * Measures both successful and failed stages so slow failures remain observable.
   * @param stage Internal telemetry label; never include customer or payment identifiers.
   * @param operation Request-local work whose original result or rejection is preserved.
   * @returns The operation's result without changing its error semantics.
   * @example const methods = await timing.measure('methods', () => loadMethods());
   */
  async measure<T>(stage: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await operation();
    } finally {
      this.durations[stage] = performance.now() - start;
    }
  }

  /**
   * Exposes coarse durations to browser DevTools without including financial context.
   * @returns Server-Timing header value containing completed stage measurements.
   * @example response.headers.set('Server-Timing', timing.toHeader());
   */
  toHeader(): string {
    return Object.entries(this.durations)
      .map(([stage, duration]) => `${stage};dur=${duration.toFixed(1)}`)
      .join(', ');
  }

  /**
   * Copies telemetry so subsequent measurements cannot mutate an emitted log entry.
   * @returns A detached map of completed stage durations in milliseconds.
   * @example logger.info('Quote completed', { durationsMs: timing.snapshot() });
   */
  snapshot(): Readonly<Record<string, number>> {
    return { ...this.durations };
  }
}
