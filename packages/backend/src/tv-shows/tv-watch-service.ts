import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';
import { DEFAULT_WATCH_SOURCE, type WatchSource } from '../watch/watch-source.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export function createTvWatchService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'tv-watch-service', context });

  return {
    async markEpisodeWatched(
      seriesTmdbId: string,
      seasonNumber: number,
      episodeNumber: number,
      userId: number,
      watchedAt: Date,
      source: WatchSource = DEFAULT_WATCH_SOURCE
    ) {
      const logger = localLogger('markEpisodeWatched');
      logger.debug(
        { seriesTmdbId, seasonNumber, episodeNumber, userId, watchedAt, source },
        'Recording TV watch event'
      );

      const existing = await prisma.tvWatchEntry.findUnique({
        where: {
          seriesTmdbId_seasonNumber_episodeNumber_userId: {
            seriesTmdbId,
            seasonNumber,
            episodeNumber,
            userId,
          },
        },
      });

      const duplicateHistory = await prisma.tvWatchHistory.findFirst({
        where: { seriesTmdbId, seasonNumber, episodeNumber, userId, watchedAt },
      });

      if (!existing) {
        const watchEntry = await prisma.tvWatchEntry.create({
          data: {
            seriesTmdbId,
            seasonNumber,
            episodeNumber,
            userId,
            latestWatchedAt: watchedAt,
            source,
            watchHistory: duplicateHistory
              ? undefined
              : {
                  create: [
                    {
                      seriesTmdbId,
                      seasonNumber,
                      episodeNumber,
                      userId,
                      watchedAt,
                      source,
                    },
                  ],
                },
          },
        });

        if (duplicateHistory) {
          await prisma.tvWatchHistory.updateMany({
            where: {
              seriesTmdbId,
              seasonNumber,
              episodeNumber,
              userId,
              watchedAt,
            },
            data: { tvWatchEntryId: watchEntry.id },
          });
        }

        return watchEntry;
      }

      if (!duplicateHistory) {
        await prisma.tvWatchHistory.create({
          data: {
            seriesTmdbId,
            seasonNumber,
            episodeNumber,
            userId,
            watchedAt,
            source,
            tvWatchEntryId: existing.id,
          },
        });
      }

      if (watchedAt > existing.latestWatchedAt) {
        return prisma.tvWatchEntry.update({
          where: {
            seriesTmdbId_seasonNumber_episodeNumber_userId: {
              seriesTmdbId,
              seasonNumber,
              episodeNumber,
              userId,
            },
          },
          data: { latestWatchedAt: watchedAt, source },
        });
      }

      return existing;
    },

    async unmarkEpisodeWatched(
      seriesTmdbId: string,
      seasonNumber: number,
      episodeNumber: number,
      userId: number
    ) {
      const logger = localLogger('unmarkEpisodeWatched');
      logger.debug(
        { seriesTmdbId, seasonNumber, episodeNumber, userId },
        'Deleting TV watch entry'
      );
      await prisma.tvWatchEntry.deleteMany({
        where: { seriesTmdbId, seasonNumber, episodeNumber, userId },
      });
    },

    async getWatchEntriesForSeries(seriesTmdbId: string, userId: number) {
      const logger = localLogger('getWatchEntriesForSeries');
      logger.debug({ seriesTmdbId, userId }, 'Fetching TV watch entries for series');

      return prisma.tvWatchEntry.findMany({
        where: { seriesTmdbId, userId },
        orderBy: [{ seasonNumber: 'asc' }, { episodeNumber: 'asc' }],
      });
    },

    async createWatchEntryIfMissing(
      seriesTmdbId: string,
      seasonNumber: number,
      episodeNumber: number,
      userId: number,
      watchedAt: Date,
      source: WatchSource = DEFAULT_WATCH_SOURCE
    ) {
      const logger = localLogger('createWatchEntryIfMissing');
      logger.debug(
        { seriesTmdbId, seasonNumber, episodeNumber, userId, watchedAt, source },
        'Creating TV watch entry only if missing'
      );

      const existing = await prisma.tvWatchEntry.findUnique({
        where: {
          seriesTmdbId_seasonNumber_episodeNumber_userId: {
            seriesTmdbId,
            seasonNumber,
            episodeNumber,
            userId,
          },
        },
      });

      if (existing) return existing;

      return prisma.tvWatchEntry.create({
        data: {
          seriesTmdbId,
          seasonNumber,
          episodeNumber,
          userId,
          latestWatchedAt: watchedAt,
          source,
        },
      });
    },
  };
}
