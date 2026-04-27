import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export function createReviewService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'review-service', context });

  return {
    async upsertReview(tmdbId: number, userId: number, content: string) {
      const logger = localLogger('upsertReview');
      logger.debug({ tmdbId, userId }, 'Upserting review');

      return prisma.review.upsert({
        where: { tmdbId_userId: { tmdbId, userId } },
        update: { content },
        create: { tmdbId, userId, content },
      });
    },

    async deleteReview(tmdbId: number, userId: number) {
      const logger = localLogger('deleteReview');
      logger.debug({ tmdbId, userId }, 'Deleting review');
      await prisma.review.deleteMany({ where: { tmdbId, userId } });
    },
  };
}
