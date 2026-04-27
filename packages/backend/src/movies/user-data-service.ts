import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export function createUserDataService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'user-data-service', context });

  return {
    async getUserMovieData(tmdbId: number, userId: number) {
      const logger = localLogger('getUserMovieData');
      logger.debug({ tmdbId, userId }, 'Loading user movie data');

      const [watchEntry, rating, review] = await Promise.all([
        prisma.watchEntry.findUnique({ where: { tmdbId_userId: { tmdbId, userId } } }),
        prisma.rating.findUnique({ where: { tmdbId_userId: { tmdbId, userId } } }),
        prisma.review.findUnique({ where: { tmdbId_userId: { tmdbId, userId } } }),
      ]);

      return {
        watchEntry: watchEntry ? { watchedAt: watchEntry.watchedAt } : null,
        rating: rating ? { score: rating.score } : null,
        review: review ? { content: review.content } : null,
      };
    },
  };
}
