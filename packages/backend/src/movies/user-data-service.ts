import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';
import type { UserFilterValue } from './movie-types.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export function createUserDataService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'user-data-service', context });

  return {
    async getFilteredTmdbIds(userId: number, filters: UserFilterValue[]): Promise<number[]> {
      const logger = localLogger('getFilteredTmdbIds');
      logger.debug({ userId, filters }, 'Fetching filtered tmdb IDs');

      const idSets = await Promise.all(
        filters.map(async filter => {
          if (filter === 'rated') {
            const records = await prisma.rating.findMany({
              where: { userId },
              select: { tmdbId: true },
            });
            return records.map(({ tmdbId }: { tmdbId: number }) => tmdbId);
          }
          if (filter === 'watched') {
            const records = await prisma.watchEntry.findMany({
              where: { userId },
              select: { tmdbId: true },
            });
            return records.map(({ tmdbId }: { tmdbId: number }) => tmdbId);
          }
          const records = await prisma.review.findMany({
            where: { userId },
            select: { tmdbId: true },
          });
          return records.map(({ tmdbId }: { tmdbId: number }) => tmdbId);
        })
      );

      const unique = new Set(idSets.flat());
      return Array.from(unique);
    },

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
