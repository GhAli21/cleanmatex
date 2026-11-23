/** cmx-workers entry point: env → Sentry → pg-boss consumer → registry loop → graceful shutdown. */
import * as Sentry from '@sentry/node';
import { loadConfig } from './config';
import { errorText, log } from './log';
import { startWorker } from './worker';

const config = loadConfig();
if (config.SENTRY_DSN) {
  Sentry.init({ dsn: config.SENTRY_DSN, environment: config.SENTRY_ENVIRONMENT, release: config.RENDER_GIT_COMMIT, tracesSampleRate: 0 });
}

/** Last failed attempt (the job goes to dead_letter) or a registry queue without a handler: alert. */
const onFinalFailure = (err: unknown, queueName: string, jobId: string) => {
  Sentry.captureException(err, { tags: { queue: queueName, jobId, app: 'cmx-workers' } });
};

async function main(): Promise<void> {
  if (!config.WORKER_ENABLED) {
    log('warn', 'WORKER_ENABLED=false: not fetching any queue');
    const idle = setInterval(() => {}, 1 << 30); // stay up so the platform does not restart-loop
    const exit = () => {
      clearInterval(idle);
      process.exit(0);
    };
    process.once('SIGTERM', exit);
    process.once('SIGINT', exit);
    return;
  }

  // Loaded after the environment is validated: the web-admin services behind the reactions read
  // their environment when they load, and a missing value should fail as "invalid environment".
  const { HANDLERS } = await import('./handlers/index');
  const worker = await startWorker(config, HANDLERS, onFinalFailure);
  let shuttingDown = false;
  const shutdown = async (sig: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('info', 'shutdown requested', { signal: sig });
    try {
      await worker.stop();
    } catch (err) {
      log('error', 'shutdown error', { error: errorText(err) });
    }
    await Sentry.close(2000);
    process.exit(0);
  };
  process.once('SIGTERM', () => {
    shutdown('SIGTERM').catch(() => process.exit(1));
  });
  process.once('SIGINT', () => {
    shutdown('SIGINT').catch(() => process.exit(1));
  });
}

main().catch(async (err) => {
  log('error', 'worker failed to start', { error: errorText(err) });
  Sentry.captureException(err);
  await Sentry.close(2000);
  process.exit(1);
});
