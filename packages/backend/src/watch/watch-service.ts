import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';
import { DEFAULT_WATCH_SOURCE, type WatchSource } from './watch-source.js';

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
      source: WatchSource = DEFAULT_WATCH_SOURCE
    ) {
      const logger = localLogger('getOrCreateWatchEntry');
      logger.debug({ tmdbId, userId, watchedAt, source }, 'Recording watch event');

      const existing = await prisma.watchEntry.findUnique({
        where: { tmdbId_userId: { tmdbId, userId } },
      });

      if (!existing) {
        return prisma.watchEntry.create({
          data: {
            tmdbId,
            userId,
            latestWatchedAt: watchedAt,
            source,
            watchHistory: {
              create: [{ tmdbId, userId, watchedAt, source }],
            },
          },
        });
      }

      await prisma.watchHistory.create({
        data: { tmdbId, userId, watchedAt, source, watchEntryId: existing.id },
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
      source: WatchSource = DEFAULT_WATCH_SOURCE
    ) {
      const logger = localLogger('createWatchEntryIfMissing');
      logger.debug({ tmdbId, userId, watchedAt, source }, 'Creating watch entry only if missing');

      const existing = await prisma.watchEntry.findUnique({
        where: { tmdbId_userId: { tmdbId, userId } },
      });

      if (existing) return existing;

      return prisma.watchEntry.create({
        data: {
          tmdbId,
          userId,
          latestWatchedAt: watchedAt,
          source,
          watchHistory: {
            create: [{ tmdbId, userId, watchedAt, source }],
          },
        },
      });
    },

    async createWatchEntryIfMissingForDay(
      tmdbId: number,
      userId: number,
      watchedAt: Date,
      source: WatchSource = DEFAULT_WATCH_SOURCE
    ) {
      const logger = localLogger('createWatchEntryIfMissingForDay');
      logger.debug(
        { tmdbId, userId, watchedAt, source },
        'Creating watch entry only if missing for this day'
      );

      const dayStart = new Date(watchedAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const existingForDay = await prisma.watchHistory.findFirst({
        where: { tmdbId, userId, watchedAt: { gte: dayStart, lt: dayEnd } },
      });

      if (existingForDay) return existingForDay;

      const existingEntry = await prisma.watchEntry.findUnique({
        where: { tmdbId_userId: { tmdbId, userId } },
      });

      if (!existingEntry) {
        return prisma.watchEntry.create({
          data: {
            tmdbId,
            userId,
            latestWatchedAt: watchedAt,
            source,
            watchHistory: {
              create: [{ tmdbId, userId, watchedAt, source }],
            },
          },
        });
      }

      await prisma.watchHistory.create({
        data: { tmdbId, userId, watchedAt, source, watchEntryId: existingEntry.id },
      });

      if (watchedAt > existingEntry.latestWatchedAt) {
        return prisma.watchEntry.update({
          where: { tmdbId_userId: { tmdbId, userId } },
          data: { latestWatchedAt: watchedAt, source },
        });
      }

      return existingEntry;
    },

    async deleteWatchEntry(tmdbId: number, userId: number) {
      const logger = localLogger('deleteWatchEntry');
      logger.debug({ tmdbId, userId }, 'Deleting watch entry');
      await prisma.watchEntry.deleteMany({ where: { tmdbId, userId } });
    },
  };
}
