import { Injectable } from '@nestjs/common';

interface Entry {
  response: unknown;
  expiresAt: number;
}

@Injectable()
export class IdempotencyStore {
  private readonly cache = new Map<string, Entry>();

  get(key: string): unknown | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.response;
  }

  set(key: string, response: unknown, ttlMs: number): void {
    this.cache.set(key, {
      response,
      expiresAt: Date.now() + ttlMs,
    });
  }
}
