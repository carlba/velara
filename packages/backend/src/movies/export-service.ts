import { stringify } from 'csv-stringify/sync';
import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

const CSV_HEADERS = ['tmdbID', 'Title', 'Year', 'WatchedDate', 'Rewatch', 'Rating10'] as const;

interface LetterboxdRow {
  tmdbID: number;
  Title: string;
  Year: string;
  WatchedDate: string;
  Rewatch: string;
  Rating10: string;
}

export function createExportService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'export-service', context });

  function closestViewingIndex(viewings: { watchedAt: Date }[], ratedDate: Date): number {
    let closestIndex = 0;
    let smallestDiff = Infinity;

    viewings.forEach((viewing, index) => {
      const diff = Math.abs(viewing.watchedAt.getTime() - ratedDate.getTime());
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  async function buildLetterboxdRows(userId: number): Promise<LetterboxdRow[]> {
    const [watchEntries, ratings] = await Promise.all([
      prisma.watchEntry.findMany({
        where: { userId },
        include: { watchHistory: { orderBy: { watchedAt: 'asc' } } },
      }),
      prisma.rating.findMany({ where: { userId } }),
    ]);

    const ratingsByTmdbId = new Map(ratings.map(rating => [rating.tmdbId, rating]));
    const rows: LetterboxdRow[] = [];

    for (const entry of watchEntries) {
      const rating = ratingsByTmdbId.get(entry.tmdbId);
      const ratedDate = rating ? (rating.ratedAt ?? rating.createdAt) : undefined;
      const ratedIndex = ratedDate ? closestViewingIndex(entry.watchHistory, ratedDate) : -1;

      entry.watchHistory.forEach((viewing, index) => {
        rows.push({
          tmdbID: entry.tmdbId,
          Title: '',
          Year: '',
          WatchedDate: viewing.watchedAt.toISOString().slice(0, 10),
          Rewatch: index > 0 ? 'true' : 'false',
          Rating10: index === ratedIndex ? String(rating!.score) : '',
        });
      });

      if (rating) {
        ratingsByTmdbId.delete(entry.tmdbId);
      }
    }

    for (const rating of ratingsByTmdbId.values()) {
      const ratedDate = rating.ratedAt ?? rating.createdAt;
      rows.push({
        tmdbID: rating.tmdbId,
        Title: '',
        Year: '',
        WatchedDate: ratedDate.toISOString().slice(0, 10),
        Rewatch: '',
        Rating10: String(rating.score),
      });
    }

    return rows;
  }

  return {
    buildLetterboxdRows,

    async exportLetterboxdCsv(userId: number): Promise<string> {
      const logger = localLogger('exportLetterboxdCsv');
      logger.debug({ userId }, 'Building Letterboxd export');

      const rows = await buildLetterboxdRows(userId);
      return stringify(rows, { header: true, columns: CSV_HEADERS });
    },
  };
}
