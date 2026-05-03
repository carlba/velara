import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export function createTvRatingService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'tv-rating-service', context });

  return {
    async upsertTvRating(
      seriesTmdbId: string,
      seasonNumber: number,
      userId: number,
      score: number,
      ratedAt?: Date,
      importedAt?: Date,
      source = 'manual'
    ) {
      const logger = localLogger('upsertTvRating');
      logger.debug(
        { seriesTmdbId, seasonNumber, userId, score, ratedAt, importedAt, source },
        'Upserting TV rating'
      );

      return prisma.tvRating.upsert({
        where: {
          seriesTmdbId_seasonNumber_userId: { seriesTmdbId, seasonNumber, userId },
        },
        update: {
          score,
          source,
          ...(ratedAt ? { ratedAt } : {}),
          ...(importedAt ? { importedAt } : {}),
        },
        create: {
          seriesTmdbId,
          seasonNumber,
          userId,
          score,
          source,
          ...(ratedAt ? { ratedAt } : {}),
          ...(importedAt ? { importedAt } : {}),
        },
      });
    },

    async deleteTvRating(seriesTmdbId: string, seasonNumber: number, userId: number) {
      const logger = localLogger('deleteTvRating');
      logger.debug({ seriesTmdbId, seasonNumber, userId }, 'Deleting TV rating');
      await prisma.tvRating.deleteMany({ where: { seriesTmdbId, seasonNumber, userId } });
    },

    async getTvRatingsForSeries(seriesTmdbId: string, userId: number) {
      const logger = localLogger('getTvRatingsForSeries');
      logger.debug({ seriesTmdbId, userId }, 'Fetching TV ratings for series');

      return prisma.tvRating.findMany({
        where: { seriesTmdbId, userId },
        orderBy: { seasonNumber: 'asc' },
      });
    },
  };
}
