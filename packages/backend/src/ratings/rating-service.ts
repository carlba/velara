import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export function createRatingService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'rating-service', context });

  return {
    async upsertRating(tmdbId: number, userId: number, score: number) {
      const logger = localLogger('upsertRating');
      logger.debug({ tmdbId, userId, score }, 'Upserting rating');

      return prisma.rating.upsert({
        where: { tmdbId_userId: { tmdbId, userId } },
        update: { score },
        create: { tmdbId, userId, score },
      });
    },

    async deleteRating(tmdbId: number, userId: number) {
      const logger = localLogger('deleteRating');
      logger.debug({ tmdbId, userId }, 'Deleting rating');
      await prisma.rating.deleteMany({ where: { tmdbId, userId } });
    },
  };
}
