import { LOGGER, config } from '../registry.js';
import { createTraktService } from './trakt-service.js';

const SYNC_INTERVAL_MS = 30_000;

const moduleLogger = LOGGER.child({ module: 'trakt-scheduler' });

export function startTraktSyncScheduler() {
  const localLogger = moduleLogger.child({ context: startTraktSyncScheduler.name });
  if (!config.TRAKT_CLIENT_ID || !config.TRAKT_CLIENT_SECRET) {
    localLogger.info('Trakt credentials are not configured. Skipping Trakt sync scheduler.');
    return;
  }

  const traktService = createTraktService();
  let isRunning = false;

  async function runSync() {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      await traktService.syncActiveIntegrations();
    } catch (error) {
      localLogger.error({ err: error }, 'Trakt sync scheduler failed');
    } finally {
      isRunning = false;
    }
  }

  void runSync();
  const timer = setInterval(() => {
    void runSync();
  }, SYNC_INTERVAL_MS);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
