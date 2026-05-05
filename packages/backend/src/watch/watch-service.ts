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
      logger.debug({ tmdbId, userId, watchedAt, source }, 'Recording watch event');

      const existing = await prisma.watchEntry.findUnique({
        where: { tmdbId_userId: { tmdbId, userId } },
      });

      if (!existing) {
        const [, watchEntry] = await prisma.$transaction([
          prisma.watchHistory.create({
            data: { tmdbId, userId, watchedAt, source },
          }),
          prisma.watchEntry.create({
            data: { tmdbId, userId, latestWatchedAt: watchedAt, source },
          }),
        ]);
        return watchEntry;
      }

      await prisma.watchHistory.create({
        data: { tmdbId, userId, watchedAt, source },
      });

      if (watchedAt > existing.latestWatchedAt) {
        return prisma.watchEntry.update({
          where: { tmdbId_userId: { tmdbId, userId } },
          data: { latestWatchedAt: watchedAt, source },
        });
      }

      return existing;
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

      const [, watchEntry] = await prisma.$transaction([
        prisma.watchHistory.create({
          data: { tmdbId, userId, watchedAt, source },
        }),
        prisma.watchEntry.create({
          data: { tmdbId, userId, latestWatchedAt: watchedAt, source },
        }),
      ]);

      return watchEntry;
    },

    async deleteWatchEntry(tmdbId: number, userId: number) {
      const logger = localLogger('deleteWatchEntry');
      logger.debug({ tmdbId, userId }, 'Deleting watch entry');
      await prisma.watchEntry.deleteMany({ where: { tmdbId, userId } });
    },
  };
}
