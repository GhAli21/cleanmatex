/** Worker environment, validated once at start. A missing or bad value stops the process before it touches a queue. */
import { z } from 'zod';

const flag = z.enum(['true', 'false']).transform((v) => v === 'true');

export function isLocalDatabase(url: string): boolean {
  const host = new URL(url).hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

const ENV = z
  .object({
    /** Supabase session pooler (port 5432). Never the transaction pooler: pg-boss needs session state (DESIGN §13.1). */
    JOBS_DATABASE_URL: z.string().url(),
    /** PEM of the Supabase CA (Dashboard → Database → SSL). Required for any non-local database; the server certificate is verified. */
    JOBS_DATABASE_CA_CERT: z.string().optional(),
    JOBS_DB_POOL_MAX: z.coerce.number().int().min(2).max(10).default(4),
    /**
     * Prisma, for the web-admin services that reactions run (read by @prisma/client itself).
     * Supabase transaction pooler (port 6543) with `pgbouncer=true&connection_limit=3&sslmode=require`.
     */
    DATABASE_URL: z.string().url(),
    /**
     * Read by the web-admin services the reactions run, exactly as on the web-admin server: some
     * create a Supabase client when they load. Same values as the web-admin deployment.
     */
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    /** The one switch (DESIGN §8.3): false = the process stays up and fetches nothing. */
    WORKER_ENABLED: flag.default(true),
    /** How often pause/resume and queue settings are read from the registry. */
    REGISTRY_POLL_SECONDS: z.coerce.number().min(1).max(300).default(30),
    WORKER_INSTANCE_NAME: z.string().min(1).default('cmx-workers'),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ENVIRONMENT: z.string().default('production'),
    /** Set by Render; reported as the worker version. */
    RENDER_GIT_COMMIT: z.string().optional(),
  })
  .refine((e) => isLocalDatabase(e.JOBS_DATABASE_URL) || !!e.JOBS_DATABASE_CA_CERT?.includes('BEGIN CERTIFICATE'), {
    path: ['JOBS_DATABASE_CA_CERT'],
    message: 'required for a non-local database',
  });

export type WorkerConfig = z.infer<typeof ENV>;

/** What the operator tools (smoke, publish-events) need: the jobs database only. */
const JOBS_DB_ENV = z
  .object({ JOBS_DATABASE_URL: z.string().url(), JOBS_DATABASE_CA_CERT: z.string().optional() })
  .refine((e) => isLocalDatabase(e.JOBS_DATABASE_URL) || !!e.JOBS_DATABASE_CA_CERT?.includes('BEGIN CERTIFICATE'), {
    path: ['JOBS_DATABASE_CA_CERT'],
    message: 'required for a non-local database',
  });

export type JobsDbConfig = z.infer<typeof JOBS_DB_ENV>;

function parse<T>(schema: z.ZodType<T>, env: NodeJS.ProcessEnv): T {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    // Names only: values may be secrets.
    const fields = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`cmx-workers: invalid environment (${fields})`);
  }
  return parsed.data;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return parse(ENV, env);
}

export function loadJobsDbConfig(env: NodeJS.ProcessEnv = process.env): JobsDbConfig {
  return parse(JOBS_DB_ENV, env);
}

/** TLS for a jobs-database connection: none locally, otherwise verified against the Supabase CA. */
export function jobsDbSsl(config: JobsDbConfig) {
  return isLocalDatabase(config.JOBS_DATABASE_URL) ? undefined : { ca: config.JOBS_DATABASE_CA_CERT, rejectUnauthorized: true };
}
