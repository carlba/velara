import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';
import { createMovieService } from '../movies/movie-service.js';
import { createTvShowService } from '../tv-shows/tv-show-service.js';
import type { MovieListItem } from '../movies/movie-types.js';
import type { HistoryItem, HistoryTypeFilter } from './history-types.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

interface GetHistoryPageParams {
  userId: number;
  type: HistoryTypeFilter;
  before?: string;
  limit: number;
}

interface MovieHistoryRow {
  id: number;
  tmdbId: number;
  watchedAt: Date;
}

interface EpisodeHistoryRow {
  id: number;
  seriesTmdbId: string;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: Date;
}

export function createHistoryService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;
  const movieService = createMovieService({ logger: serviceLogger });
  const tvShowService = createTvShowService({ logger: serviceLogger });

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'history-service', context });

  async function fetchMovieRows(
    userId: number,
    before: string | undefined,
    limit: number
  ): Promise<MovieHistoryRow[]> {
    return prisma.watchHistory.findMany({
      where: { userId, ...(before ? { watchedAt: { lt: new Date(before) } } : {}) },
      orderBy: [{ watchedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: { id: true, tmdbId: true, watchedAt: true },
    });
  }

  async function fetchEpisodeRows(
    userId: number,
    before: string | undefined,
    limit: number
  ): Promise<EpisodeHistoryRow[]> {
    return prisma.tvWatchHistory.findMany({
      where: { userId, ...(before ? { watchedAt: { lt: new Date(before) } } : {}) },
      orderBy: [{ watchedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        seriesTmdbId: true,
        seasonNumber: true,
        episodeNumber: true,
        watchedAt: true,
      },
    });
  }

  async function buildMovieItems(rows: MovieHistoryRow[]): Promise<HistoryItem[]> {
    const logger = localLogger('buildMovieItems');
    const distinctTmdbIds = Array.from(new Set(rows.map(row => row.tmdbId)));

    const movieEntries = await Promise.all(
      distinctTmdbIds.map(async tmdbId => {
        try {
          // getMovieById's declared return type is stale (TMDB snake_case); the runtime
          // value is actually MovieListItem-shaped (mapListItem() converts it).
          const movie = (await movieService.getMovieById(tmdbId)) as unknown as MovieListItem;
          return [tmdbId, movie] as const;
        } catch (error) {
          logger.warn({ tmdbId, err: error }, 'Failed to fetch movie for history item');
          return [tmdbId, null] as const;
        }
      })
    );
    const movieMap = new Map(movieEntries);

    return rows.map(row => {
      const movie = movieMap.get(row.tmdbId) ?? null;
      return {
        historyId: row.id,
        mediaType: 'movie' as const,
        watchedAt: row.watchedAt.toISOString(),
        tmdbId: row.tmdbId,
        title: movie?.title ?? 'Unknown movie',
        posterPath: movie?.posterPath ?? null,
        releaseYear: movie?.releaseDate ? new Date(movie.releaseDate).getFullYear() : null,
      };
    });
  }

  async function buildEpisodeItems(rows: EpisodeHistoryRow[]): Promise<HistoryItem[]> {
    const logger = localLogger('buildEpisodeItems');
    const distinctSeriesTmdbIds = Array.from(new Set(rows.map(row => row.seriesTmdbId)));
    const distinctSeasons = Array.from(
      new Map(
        rows.map(row => [
          `${row.seriesTmdbId}:${row.seasonNumber}`,
          { seriesTmdbId: row.seriesTmdbId, seasonNumber: row.seasonNumber },
        ])
      ).values()
    );

    const [seriesEntries, seasonEntries] = await Promise.all([
      Promise.all(
        distinctSeriesTmdbIds.map(async seriesTmdbId => {
          try {
            return [seriesTmdbId, await tvShowService.getTvShowById(seriesTmdbId)] as const;
          } catch (error) {
            logger.warn(
              { seriesTmdbId, err: error },
              'Failed to fetch TV show for history item'
            );
            return [seriesTmdbId, null] as const;
          }
        })
      ),
      Promise.all(
        distinctSeasons.map(async ({ seriesTmdbId, seasonNumber }) => {
          const key = `${seriesTmdbId}:${seasonNumber}`;
          try {
            return [key, await tvShowService.getTvSeason(seriesTmdbId, seasonNumber)] as const;
          } catch (error) {
            logger.warn(
              { seriesTmdbId, seasonNumber, err: error },
              'Failed to fetch TV season for history item'
            );
            return [key, null] as const;
          }
        })
      ),
    ]);

    const seriesMap = new Map(seriesEntries);
    const seasonMap = new Map(seasonEntries);

    return rows.map(row => {
      const series = seriesMap.get(row.seriesTmdbId) ?? null;
      const season = seasonMap.get(`${row.seriesTmdbId}:${row.seasonNumber}`) ?? null;
      const episode = season?.episodes.find(ep => ep.episodeNumber === row.episodeNumber) ?? null;

      return {
        historyId: row.id,
        mediaType: 'episode' as const,
        watchedAt: row.watchedAt.toISOString(),
        title: series?.name ?? 'Unknown show',
        posterPath: episode?.stillPath ?? series?.posterPath ?? null,
        seriesTmdbId: row.seriesTmdbId,
        seriesName: series?.name ?? 'Unknown show',
        seasonNumber: row.seasonNumber,
        episodeNumber: row.episodeNumber,
        episodeName: episode?.name,
        stillPath: episode?.stillPath ?? null,
      };
    });
  }

  return {
    async getHistoryPage({ userId, type, before, limit }: GetHistoryPageParams) {
      const logger = localLogger('getHistoryPage');
      logger.debug({ userId, type, before, limit }, 'Loading history page');

      const [movieRows, episodeRows] = await Promise.all([
        type === 'shows' ? [] : fetchMovieRows(userId, before, limit),
        type === 'movies' ? [] : fetchEpisodeRows(userId, before, limit),
      ]);

      const [movieItems, episodeItems] = await Promise.all([
        buildMovieItems(movieRows),
        buildEpisodeItems(episodeRows),
      ]);

      const merged = [...movieItems, ...episodeItems].sort((left, right) =>
        left.watchedAt < right.watchedAt ? 1 : left.watchedAt > right.watchedAt ? -1 : 0
      );

      const items = merged.slice(0, limit);
      const lastItem = items[items.length - 1];
      const hasMore = movieRows.length === limit || episodeRows.length === limit;

      return {
        items,
        nextCursor: lastItem ? lastItem.watchedAt : null,
        hasMore,
      };
    },

    async deleteMovieHistoryRecord(historyId: number, userId: number): Promise<void> {
      const logger = localLogger('deleteMovieHistoryRecord');
      logger.debug({ historyId, userId }, 'Deleting movie history record');

      await prisma.$transaction(async tx => {
        const record = await tx.watchHistory.findFirst({ where: { id: historyId, userId } });
        if (!record) {
          throw new HttpError('History record not found', { statusCode: 404 });
        }

        await tx.watchHistory.delete({ where: { id: historyId } });

        const latestRemaining = await tx.watchHistory.findFirst({
          where: { watchEntryId: record.watchEntryId },
          orderBy: { watchedAt: 'desc' },
        });

        if (!latestRemaining) {
          await tx.watchEntry.delete({ where: { id: record.watchEntryId } });
        } else {
          await tx.watchEntry.update({
            where: { id: record.watchEntryId },
            data: { latestWatchedAt: latestRemaining.watchedAt, source: latestRemaining.source },
          });
        }
      });
    },

    async deleteEpisodeHistoryRecord(historyId: number, userId: number): Promise<void> {
      const logger = localLogger('deleteEpisodeHistoryRecord');
      logger.debug({ historyId, userId }, 'Deleting episode history record');

      await prisma.$transaction(async tx => {
        const record = await tx.tvWatchHistory.findFirst({ where: { id: historyId, userId } });
        if (!record) {
          throw new HttpError('History record not found', { statusCode: 404 });
        }

        await tx.tvWatchHistory.delete({ where: { id: historyId } });

        const latestRemaining = await tx.tvWatchHistory.findFirst({
          where: { tvWatchEntryId: record.tvWatchEntryId },
          orderBy: { watchedAt: 'desc' },
        });

        if (!latestRemaining) {
          await tx.tvWatchEntry.delete({ where: { id: record.tvWatchEntryId } });
        } else {
          await tx.tvWatchEntry.update({
            where: { id: record.tvWatchEntryId },
            data: { latestWatchedAt: latestRemaining.watchedAt, source: latestRemaining.source },
          });
        }
      });
    },
  };
}
