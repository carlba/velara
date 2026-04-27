import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';
import type { SortBy, UserFilterValue } from './movie-types.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export function createUserDataService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'user-data-service', context });

  async function fetchIdsForFilter(userId: number, filter: UserFilterValue): Promise<number[]> {
    if (filter === 'rated') {
      const records = (await prisma.rating.findMany({
        where: { userId },
        select: { tmdbId: true },
      })) as { tmdbId: number }[];
      return records.map(record => record.tmdbId);
    }
    if (filter === 'watched') {
      const records = (await prisma.watchEntry.findMany({
        where: { userId },
        select: { tmdbId: true },
      })) as { tmdbId: number }[];
      return records.map(record => record.tmdbId);
    }
    const records = (await prisma.review.findMany({
      where: { userId },
      select: { tmdbId: true },
    })) as { tmdbId: number }[];
    return records.map(record => record.tmdbId);
  }

  return {
    async getFilteredTmdbIds(
      userId: number,
      filters: UserFilterValue[],
      sortBy?: SortBy
    ): Promise<number[]> {
      const logger = localLogger('getFilteredTmdbIds');
      logger.debug({ userId, filters, sortBy }, 'Fetching filtered tmdb IDs');

      if (sortBy === 'watched_date') {
        const entries = (await prisma.watchEntry.findMany({
          where: { userId },
          orderBy: [{ watchedAt: 'desc' }, { tmdbId: 'desc' }],
          select: { tmdbId: true },
        })) as { tmdbId: number }[];
        const orderedIds = entries.map(entry => entry.tmdbId);
        const intersectionFilters = filters.filter(filter => filter !== 'watched');
        if (intersectionFilters.length === 0) return orderedIds;
        const intersectionIdSets = await Promise.all(
          intersectionFilters.map(filter => fetchIdsForFilter(userId, filter))
        );
        const additionalIds = new Set(intersectionIdSets.flat());
        return orderedIds.filter((id: number) => additionalIds.has(id));
      }

      if (sortBy === 'my_rating') {
        const entries = (await prisma.rating.findMany({
          where: { userId },
          orderBy: [{ score: 'desc' }, { tmdbId: 'desc' }],
          select: { tmdbId: true },
        })) as { tmdbId: number }[];
        const orderedIds = entries.map(entry => entry.tmdbId);
        const intersectionFilters = filters.filter(filter => filter !== 'rated');
        if (intersectionFilters.length === 0) return orderedIds;
        const intersectionIdSets = await Promise.all(
          intersectionFilters.map(filter => fetchIdsForFilter(userId, filter))
        );
        const additionalIds = new Set(intersectionIdSets.flat());
        return orderedIds.filter((id: number) => additionalIds.has(id));
      }

      const idSets = await Promise.all(filters.map(filter => fetchIdsForFilter(userId, filter)));
      return Array.from(new Set(idSets.flat()));
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
