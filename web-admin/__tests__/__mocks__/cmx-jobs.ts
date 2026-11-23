/**
 * Jest stand-in for `@cmx/jobs` (mapped in jest.config.js). The real package is ESM-only pg-boss and
 * is proved by its own tests (`npm test --workspace=@cmx/jobs`) and by cmx-workers' integration tests.
 * `mockJobProducer` records calls so a service test can assert what was published.
 */
export const mockJobProducer = {
  enqueue: jest.fn(async () => null as string | null),
  publish: jest.fn(async () => undefined),
  stop: jest.fn(async () => undefined),
};

export const createJobProducer = jest.fn(() => mockJobProducer);
export const claimEffect = jest.fn(async () => true);
export const DEAD_LETTER_QUEUE = 'dead_letter';
