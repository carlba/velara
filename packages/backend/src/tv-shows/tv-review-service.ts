import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export function createTvReviewService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'tv-review-service', context });

  return {
    async upsertTvReview(seriesTmdbId: string, userId: number, content: string) {
      const logger = localLogger('upsertTvReview');
      logger.debug({ seriesTmdbId, userId }, 'Upserting TV review');

      return prisma.tvReview.upsert({
        where: { seriesTmdbId_userId: { seriesTmdbId, userId } },
        update: { content },
        create: { seriesTmdbId, userId, content },
      });
    },

    async deleteTvReview(seriesTmdbId: string, userId: number) {
      const logger = localLogger('deleteTvReview');
      logger.debug({ seriesTmdbId, userId }, 'Deleting TV review');
      await prisma.tvReview.deleteMany({ where: { seriesTmdbId, userId } });
    },
  };
}
