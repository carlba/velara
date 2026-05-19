import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';
import type { TvSortBy, TvUserFilterValue } from './tv-show-types.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export function createTvUserDataService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'tv-user-data-service', context });

  async function fetchSeriesIdsForFilter(
    userId: number,
    filter: TvUserFilterValue
  ): Promise<string[]> {
    if (filter === 'rated') {
      const records = await prisma.tvRating.findMany({
        where: { userId, seasonNumber: 0 },
        select: { seriesTmdbId: true },
      });
      return records.map(record => record.seriesTmdbId);
    }
    if (filter === 'watched') {
      const records = await prisma.tvWatchEntry.findMany({
        where: { userId },
        select: { seriesTmdbId: true },
        distinct: ['seriesTmdbId'],
      });
      return records.map(record => record.seriesTmdbId);
    }
    if (filter === 'reviewed') {
      const records = await prisma.tvReview.findMany({
        where: { userId },
        select: { seriesTmdbId: true },
      });
      return records.map(record => record.seriesTmdbId);
    }

    const records = await prisma.tvComment.findMany({
      where: { userId },
      select: { seriesTmdbId: true },
      distinct: ['seriesTmdbId'],
    });
    return records.map(record => record.seriesTmdbId);
  }

  return {
    async getFilteredSeriesTmdbIds(
      userId: number,
      filters: TvUserFilterValue[],
      sortBy?: TvSortBy
    ): Promise<string[]> {
      const logger = localLogger('getFilteredSeriesTmdbIds');
      logger.debug({ userId, filters, sortBy }, 'Fetching filtered TV series IDs');

      if (sortBy === 'watched_date') {
        const entries = await prisma.tvWatchEntry.findMany({
          where: { userId },
          orderBy: [{ latestWatchedAt: 'desc' }],
          select: { seriesTmdbId: true },
          distinct: ['seriesTmdbId'],
        });
        const orderedIds = entries.map(entry => entry.seriesTmdbId);
        const intersectionFilters = filters.filter(filterVal => filterVal !== 'watched');
        if (intersectionFilters.length === 0) return orderedIds;
        const intersectionIdSets = await Promise.all(
          intersectionFilters.map(filterVal => fetchSeriesIdsForFilter(userId, filterVal))
        );
        const additionalIds = new Set(intersectionIdSets.flat());
        return orderedIds.filter(id => additionalIds.has(id));
      }

      if (sortBy === 'my_rating') {
        const entries = await prisma.tvRating.findMany({
          where: { userId, seasonNumber: 0 },
          orderBy: [{ score: 'desc' }],
          select: { seriesTmdbId: true },
        });
        const orderedIds = entries.map(entry => entry.seriesTmdbId);
        const intersectionFilters = filters.filter(filterVal => filterVal !== 'rated');
        if (intersectionFilters.length === 0) return orderedIds;
        const intersectionIdSets = await Promise.all(
          intersectionFilters.map(filterVal => fetchSeriesIdsForFilter(userId, filterVal))
        );
        const additionalIds = new Set(intersectionIdSets.flat());
        return orderedIds.filter(id => additionalIds.has(id));
      }

      const idSets = await Promise.all(
        filters.map(filterVal => fetchSeriesIdsForFilter(userId, filterVal))
      );
      return Array.from(new Set(idSets.flat()));
    },

    async getUserTvData(seriesTmdbId: string, userId: number) {
      const logger = localLogger('getUserTvData');
      logger.debug({ seriesTmdbId, userId }, 'Loading user TV show data');

      const [watchEntries, ratings, review] = await Promise.all([
        prisma.tvWatchEntry.findMany({
          where: { seriesTmdbId, userId },
          orderBy: [{ seasonNumber: 'asc' }, { episodeNumber: 'asc' }],
          select: {
            seasonNumber: true,
            episodeNumber: true,
            latestWatchedAt: true,
            source: true,
            watchHistory: {
              orderBy: { watchedAt: 'desc' },
              select: { watchedAt: true, source: true },
            },
          },
        }),
        prisma.tvRating.findMany({
          where: { seriesTmdbId, userId },
          orderBy: { seasonNumber: 'asc' },
          select: { seasonNumber: true, score: true },
        }),
        prisma.tvReview.findUnique({ where: { seriesTmdbId_userId: { seriesTmdbId, userId } } }),
      ]);

      const watchHistory = watchEntries
        .flatMap(entry =>
          entry.watchHistory.map(history => ({
            seasonNumber: entry.seasonNumber,
            episodeNumber: entry.episodeNumber,
            watchedAt: history.watchedAt,
            source: history.source,
          }))
        )
        .sort((left, right) =>
          left.watchedAt < right.watchedAt ? 1 : left.watchedAt > right.watchedAt ? -1 : 0
        );

      const showRating = ratings.find(rating => rating.seasonNumber === 0);
      const seasonRatings = Object.fromEntries(
        ratings
          .filter(rating => rating.seasonNumber !== 0)
          .map(rating => [rating.seasonNumber, rating.score])
      );

      return {
        watchEntries: watchEntries.map(entry => ({
          seasonNumber: entry.seasonNumber,
          episodeNumber: entry.episodeNumber,
          watchedAt: entry.latestWatchedAt,
          source: entry.source,
        })),
        watchHistory,
        showRating: showRating ? { score: showRating.score } : null,
        seasonRatings,
        review: review ? { content: review.content } : null,
      };
    },
  };
}
