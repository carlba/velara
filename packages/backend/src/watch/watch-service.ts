import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export function createWatchService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'watch-service', context });

  return {
    async getOrCreateWatchEntry(
      tmdbId: number,
      userId: number,
      watchedAt: Date,
      source = 'manual'
    ) {
      const logger = localLogger('getOrCreateWatchEntry');
      logger.debug({ tmdbId, userId, watchedAt, source }, 'Upserting watch entry');

      return prisma.watchEntry.upsert({
        where: { tmdbId_userId: { tmdbId, userId } },
        update: { watchedAt, source },
        create: { tmdbId, userId, watchedAt, source },
      });
    },

    async createWatchEntryIfMissing(
      tmdbId: number,
      userId: number,
      watchedAt: Date,
      source = 'manual'
    ) {
      const logger = localLogger('createWatchEntryIfMissing');
      logger.debug({ tmdbId, userId, watchedAt, source }, 'Creating watch entry only if missing');

      const existing = await prisma.watchEntry.findUnique({
        where: { tmdbId_userId: { tmdbId, userId } },
      });

      if (existing) return existing;

      return prisma.watchEntry.create({
        data: { tmdbId, userId, watchedAt, source },
      });
    },

    async deleteWatchEntry(tmdbId: number, userId: number) {
      const logger = localLogger('deleteWatchEntry');
      logger.debug({ tmdbId, userId }, 'Deleting watch entry');
      await prisma.watchEntry.deleteMany({ where: { tmdbId, userId } });
    },
  };
}
