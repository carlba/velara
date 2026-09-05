import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { LOGGER } from '../registry.js';
import { createCommentService } from '../comments/comment-service.js';
import { createMovieService } from './movie-service.js';
import { createRatingService } from '../ratings/rating-service.js';
import { createWatchService } from '../watch/watch-service.js';
import { createTvRatingService } from '../tv-shows/tv-rating-service.js';
import { createTvWatchService } from '../tv-shows/tv-watch-service.js';
import type {
  TraktExport,
  TraktMovie,
  TraktRatingEntry,
  TraktHistoryEntry,
} from '../trakt/trakt.types.js';
import { WatchSource } from '../watch/watch-source.js';

const TRAKT_SOURCE = WatchSource.Trakt;
const FILMTIPSET_SOURCE_COMMENTS = WatchSource.FilmtipsetComments;
const FILMTIPSET_SOURCE_RATINGS = WatchSource.FilmtipsetRatings;

interface ImportLogger {
  error: (...args: unknown[]) => void;
}

interface ServiceOptions {
  logger?: Logger | FastifyBaseLogger;
}

export interface ImportSummary {
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

export type FilmtipsetImportType = 'ratings' | 'comments';

export function normalizeImdbId(value: string): string | null {
  const normalized = value.trim();

  if (!/^[0-9]{4,7}$/.test(normalized)) {
    return null;
  }

  return `tt${normalized.padStart(7, '0')}`;
}

const imdbIdSchema = z
  .string()
  .regex(/^[0-9]{4,7}$/, 'invalid IMDB id')
  .transform(value => `tt${value.padStart(7, '0')}`);

export const ratingRowSchema = z
  .tuple([
    z.coerce.date(),
    z.string().min(1, 'title is required'),
    imdbIdSchema,
    z
      .string()
      .regex(/^[1-5]$/, 'score must be an integer between 1 and 5')
      .transform(value => Number(value)),
  ])
  .transform(([watchedAt, title, imdbId, score]) => ({
    imdbId,
    score,
    watchedAt,
    title,
  }));

export const commentRowSchema = z
  .tuple([
    z.coerce.date(),
    z.string().min(1, 'title is required'),
    imdbIdSchema,
    z.string().min(1, 'comment text is required'),
  ])
  .transform(([watchedAt, title, imdbId, comment]) => ({
    imdbId,
    watchedAt,
    title,
    comment,
  }));

export type ParsedCsvRow<T> = T & { line: number };

type ParsedCsvResult<T> =
  | { row: ParsedCsvRow<T>; error?: undefined }
  | { error: string; row?: undefined };

type TraktMovieRatingEntry = Extract<TraktRatingEntry, { type: 'movie' }>;
type TraktMovieHistoryEntry = Extract<TraktHistoryEntry, { type: 'movie' }>;
type TraktShowRatingEntry = Extract<TraktRatingEntry, { type: 'show' }>;
type TraktEpisodeHistoryEntry = Extract<TraktHistoryEntry, { type: 'episode' }>;

function normalizeFilmtipsetCsvRow(rawLine: unknown[]): unknown[] {
  if (rawLine.length === 3 && typeof rawLine[0] === 'string' && rawLine[0].includes(',')) {
    const [date, title] = rawLine[0].split(',', 2).map(part => part.trim());
    if (date && title) {
      return [date, title, rawLine[1], rawLine[2]];
    }
  }

  return rawLine;
}

export function parseFilmtipsetCsvRows<T>(
  content: string,
  logger: ImportLogger,
  rowSchema: z.ZodType<T>,
  requiredHeaders: string[]
): { rows: ParsedCsvRow<T>[]; errors: string[] } {
  const records = parse(content, {
    delimiter: ';',
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  if (records.length === 0) {
    return { rows: [], errors: ['File content is empty'] };
  }

  const header = records[0].map(column => String(column).toLowerCase());
  const hasHeader = requiredHeaders.every(label => header.includes(label));
  const startIndex = hasHeader ? 1 : 0;

  const results = records.slice(startIndex).map((rawLine, rowIndex): ParsedCsvResult<T> => {
    const lineNumber = startIndex + rowIndex + 1;
    const rawImdb = rawLine[2];
    const normalizedLine = normalizeFilmtipsetCsvRow(rawLine);
    const result = rowSchema.safeParse(normalizedLine);

    if (!result.success) {
      logger.error(
        { line: lineNumber, rawImdb, issues: result.error.issues },
        'Row validation failed'
      );

      return {
        error: `Line ${lineNumber}: ${JSON.stringify(result.error.issues)}`,
      };
    }

    return { row: { ...result.data, line: lineNumber } };
  });

  return {
    rows: results
      .filter((result): result is { row: ParsedCsvRow<T> } => result.row !== undefined)
      .map(result => result.row),
    errors: results
      .filter((result): result is { error: string } => result.error !== undefined)
      .map(result => result.error),
  };
}

function dedupeRowsByImdbId<T extends { imdbId: string; watchedAt: Date }>(rows: T[]) {
  const dedupedRows = new Map<string, T>();
  for (const row of rows) {
    const existing = dedupedRows.get(row.imdbId);
    if (!existing || row.watchedAt > existing.watchedAt) {
      dedupedRows.set(row.imdbId, row);
    }
  }
  return dedupedRows;
}

function getTraktMovieKey(movie: TraktMovie): string | null {
  if (typeof movie.ids?.tmdb === 'number') {
    return `tmdb:${movie.ids.tmdb}`;
  }

  if (typeof movie.ids?.imdb === 'string' && movie.ids.imdb.trim() !== '') {
    return `imdb:${movie.ids.imdb}`;
  }

  return null;
}

function dedupeTraktRows<T extends { key: string; timestamp: Date }>(rows: T[]) {
  const dedupedRows = new Map<string, T>();
  for (const row of rows) {
    const existing = dedupedRows.get(row.key);
    if (!existing || row.timestamp > existing.timestamp) {
      dedupedRows.set(row.key, row);
    }
  }
  return dedupedRows;
}

async function resolveTraktMovieTmdbId(
  movie: TraktMovie,
  movieService: ReturnType<typeof createMovieService>
): Promise<{ success: true; tmdbId: number } | { success: false; message: string }> {
  if (typeof movie.ids?.tmdb === 'number') {
    return { success: true, tmdbId: movie.ids.tmdb };
  }

  if (typeof movie.ids?.imdb === 'string' && movie.ids.imdb.trim() !== '') {
    const result = await movieService.findMovieByImdbId(movie.ids.imdb);
    if (result.success) {
      return { success: true, tmdbId: result.tmdbId };
    }
    return { success: false, message: result.message };
  }

  return { success: false, message: 'No valid TMDB or IMDb identifiers were available' };
}

async function importFromTraktExport(
  userId: number,
  traktExport: TraktExport,
  options: ServiceOptions
): Promise<ImportSummary> {
  const serviceLogger = options.logger ?? LOGGER;
  const logger = serviceLogger.child({ module: 'import-service', source: TRAKT_SOURCE });
  const movieService = createMovieService({ logger });
  const watchService = createWatchService({ logger });
  const ratingService = createRatingService({ logger });
  const importTimestamp = new Date();
  const errors: string[] = [];
  let importedCount = 0;
  let skippedCount = 0;

  const ratingRows = dedupeTraktRows(
    traktExport.ratings
      .filter((entry): entry is TraktMovieRatingEntry => entry.type === 'movie')
      .map(entry => ({
        key: getTraktMovieKey(entry.movie),
        movie: entry.movie,
        score: entry.rating,
        ratedAt: new Date(entry.rated_at),
        timestamp: new Date(entry.rated_at),
      }))
      .filter(
        (
          entry
        ): entry is {
          key: string;
          movie: TraktMovie;
          score: number;
          ratedAt: Date;
          timestamp: Date;
        } => Boolean(entry.key)
      )
  );

  for (const row of ratingRows.values()) {
    if (Number.isNaN(row.ratedAt.getTime())) {
      errors.push(`Rating import skipped: invalid rating date for ${row.key}`);
      skippedCount += 1;
      continue;
    }

    const resolved = await resolveTraktMovieTmdbId(row.movie, movieService);
    if (!resolved.success) {
      errors.push(`Rating import skipped: ${resolved.message}`);
      skippedCount += 1;
      continue;
    }

    try {
      await ratingService.upsertRating(
        resolved.tmdbId,
        userId,
        row.score,
        row.ratedAt,
        importTimestamp,
        TRAKT_SOURCE
      );
      importedCount += 1;
    } catch (error) {
      logger.error({ err: error, row }, 'Failed to import Trakt rating');
      errors.push('Rating import failed');
      skippedCount += 1;
    }
  }

  const historyRows = dedupeTraktRows(
    traktExport.history
      .filter((entry): entry is TraktMovieHistoryEntry => entry.type === 'movie')
      .map(entry => ({
        key: getTraktMovieKey(entry.movie),
        movie: entry.movie,
        watchedAt: new Date(entry.watched_at),
        timestamp: new Date(entry.watched_at),
      }))
      .filter(
        (entry): entry is { key: string; movie: TraktMovie; watchedAt: Date; timestamp: Date } =>
          Boolean(entry.key)
      )
  );

  for (const row of historyRows.values()) {
    if (Number.isNaN(row.watchedAt.getTime())) {
      errors.push(`Watch import skipped: invalid watch date for ${row.key}`);
      skippedCount += 1;
      continue;
    }

    const resolved = await resolveTraktMovieTmdbId(row.movie, movieService);
    if (!resolved.success) {
      errors.push(`Watch import skipped: ${resolved.message}`);
      skippedCount += 1;
      continue;
    }

    try {
      await watchService.getOrCreateWatchEntry(
        resolved.tmdbId,
        userId,
        row.watchedAt,
        TRAKT_SOURCE
      );
      importedCount += 1;
    } catch (error) {
      logger.error({ err: error, row }, 'Failed to import Trakt watch history');
      errors.push('Watch import failed');
      skippedCount += 1;
    }
  }

  // Import TV show ratings (show-level, seasonNumber=0)
  const tvRatingService = createTvRatingService({ logger });
  const tvRatingRows = traktExport.ratings
    .filter((entry): entry is TraktShowRatingEntry => entry.type === 'show')
    .filter(entry => typeof entry.show.ids?.tmdb === 'number');

  for (const entry of tvRatingRows) {
    const seriesTmdbId = String(entry.show.ids.tmdb!);
    const ratedAt = new Date(entry.rated_at);
    if (Number.isNaN(ratedAt.getTime())) {
      errors.push(`TV rating import skipped: invalid date for series ${seriesTmdbId}`);
      skippedCount += 1;
      continue;
    }
    try {
      await tvRatingService.upsertTvRating(
        seriesTmdbId,
        0,
        userId,
        entry.rating,
        ratedAt,
        importTimestamp,
        TRAKT_SOURCE
      );
      importedCount += 1;
    } catch (error) {
      logger.error({ err: error, entry }, 'Failed to import Trakt TV rating');
      errors.push('TV rating import failed');
      skippedCount += 1;
    }
  }

  // Import TV episode watch history
  const tvWatchService = createTvWatchService({ logger });
  const episodeHistoryRows = traktExport.history
    .filter((entry): entry is TraktEpisodeHistoryEntry => entry.type === 'episode')
    .filter(entry => typeof entry.show.ids?.tmdb === 'number');

  for (const entry of episodeHistoryRows) {
    const seriesTmdbId = String(entry.show.ids.tmdb!);
    const watchedAt = new Date(entry.watched_at);
    if (Number.isNaN(watchedAt.getTime())) {
      errors.push(
        `TV watch import skipped: invalid date for series ${seriesTmdbId} S${entry.episode.season}E${entry.episode.number}`
      );
      skippedCount += 1;
      continue;
    }
    try {
      await tvWatchService.markEpisodeWatched(
        seriesTmdbId,
        entry.episode.season,
        entry.episode.number,
        userId,
        watchedAt,
        TRAKT_SOURCE
      );
      importedCount += 1;
    } catch (error) {
      logger.error({ err: error, entry }, 'Failed to import Trakt TV episode history');
      errors.push('TV episode watch import failed');
      skippedCount += 1;
    }
  }

  return { importedCount, skippedCount, errors };
}

async function importTvFromTraktExport(
  userId: number,
  traktExport: TraktExport,
  options: ServiceOptions
): Promise<ImportSummary> {
  const serviceLogger = options.logger ?? LOGGER;
  const logger = serviceLogger.child({ module: 'import-service', source: TRAKT_SOURCE });
  const tvRatingService = createTvRatingService({ logger });
  const tvWatchService = createTvWatchService({ logger });
  const importTimestamp = new Date();
  const errors: string[] = [];
  let importedCount = 0;
  let skippedCount = 0;

  const tvRatingRows = traktExport.ratings
    .filter((entry): entry is TraktShowRatingEntry => entry.type === 'show')
    .filter(entry => typeof entry.show.ids?.tmdb === 'number');

  for (const entry of tvRatingRows) {
    const seriesTmdbId = String(entry.show.ids.tmdb!);
    const ratedAt = new Date(entry.rated_at);
    if (Number.isNaN(ratedAt.getTime())) {
      errors.push(`TV rating import skipped: invalid date for series ${seriesTmdbId}`);
      skippedCount += 1;
      continue;
    }
    try {
      await tvRatingService.upsertTvRating(
        seriesTmdbId,
        0,
        userId,
        entry.rating,
        ratedAt,
        importTimestamp,
        TRAKT_SOURCE
      );
      importedCount += 1;
    } catch (error) {
      logger.error({ err: error, entry }, 'Failed to import Trakt TV rating');
      errors.push('TV rating import failed');
      skippedCount += 1;
    }
  }

  const episodeHistoryRows = traktExport.history
    .filter((entry): entry is TraktEpisodeHistoryEntry => entry.type === 'episode')
    .filter(entry => typeof entry.show.ids?.tmdb === 'number');

  for (const entry of episodeHistoryRows) {
    const seriesTmdbId = String(entry.show.ids.tmdb!);
    const watchedAt = new Date(entry.watched_at);
    if (Number.isNaN(watchedAt.getTime())) {
      errors.push(
        `TV watch import skipped: invalid date for series ${seriesTmdbId} S${entry.episode.season}E${entry.episode.number}`
      );
      skippedCount += 1;
      continue;
    }
    try {
      await tvWatchService.markEpisodeWatched(
        seriesTmdbId,
        entry.episode.season,
        entry.episode.number,
        userId,
        watchedAt,
        TRAKT_SOURCE
      );
      importedCount += 1;
    } catch (error) {
      logger.error({ err: error, entry }, 'Failed to import Trakt TV episode history');
      errors.push('TV episode watch import failed');
      skippedCount += 1;
    }
  }

  return { importedCount, skippedCount, errors };
}

export async function importTvFromTrakt(
  userId: number,
  content: string,
  options?: ServiceOptions
): Promise<ImportSummary> {
  const serviceLogger = options?.logger ?? LOGGER;
  const logger = serviceLogger.child({ module: 'import-service', source: TRAKT_SOURCE });

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    logger.error({ err: error }, 'Failed to parse Trakt export JSON');
    return { importedCount: 0, skippedCount: 0, errors: ['Invalid JSON content'] };
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('ratings' in parsed) ||
    !('history' in parsed)
  ) {
    return { importedCount: 0, skippedCount: 0, errors: ['Invalid Trakt export structure'] };
  }

  return importTvFromTraktExport(userId, parsed as TraktExport, options ?? {});
}

export async function importFromTrakt(
  userId: number,
  content: string,
  options?: ServiceOptions
): Promise<ImportSummary> {
  const serviceLogger = options?.logger ?? LOGGER;
  const logger = serviceLogger.child({ module: 'import-service', source: TRAKT_SOURCE });

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    logger.error({ err: error }, 'Failed to parse Trakt export JSON');
    return { importedCount: 0, skippedCount: 0, errors: ['Invalid JSON content'] };
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('ratings' in parsed) ||
    !('history' in parsed)
  ) {
    return { importedCount: 0, skippedCount: 0, errors: ['Invalid Trakt export structure'] };
  }

  return importFromTraktExport(userId, parsed as TraktExport, options ?? {});
}

export async function importFromFilmtipset(
  userId: number,
  content: string,
  type: FilmtipsetImportType,
  options?: ServiceOptions
): Promise<ImportSummary> {
  const serviceLogger = options?.logger ?? LOGGER;
  const logger = serviceLogger.child({ module: 'import-service' });
  const movieService = createMovieService({ logger });
  const watchService = createWatchService({ logger });
  const importTimestamp = new Date();
  const errors: string[] = [];
  let importedCount = 0;
  let skippedCount = 0;

  if (type === 'ratings') {
    const parseResult = parseFilmtipsetCsvRows(content, logger, ratingRowSchema, [
      'votedate',
      'movietitle',
      'imdb',
      'score',
    ]);
    errors.push(...parseResult.errors);
    skippedCount += parseResult.errors.length;
    const dedupedRows = dedupeRowsByImdbId(parseResult.rows);
    const ratingService = createRatingService({ logger });

    for (const row of dedupedRows.values()) {
      try {
        const lookupResult = await movieService.findMovieByImdbId(row.imdbId);
        if (!lookupResult.success) {
          errors.push(
            `Line ${row.line}: ${lookupResult.message} (${lookupResult.reason}) for ${row.imdbId} (${row.title})`
          );
          skippedCount += 1;
          continue;
        }

        await ratingService.upsertRating(
          lookupResult.tmdbId,
          userId,
          row.score * 2,
          row.watchedAt,
          importTimestamp,
          FILMTIPSET_SOURCE_RATINGS
        );
        await watchService.createWatchEntryIfMissing(
          lookupResult.tmdbId,
          userId,
          row.watchedAt,
          FILMTIPSET_SOURCE_RATINGS
        );
        importedCount += 1;
      } catch (error) {
        logger.error({ err: error, row }, 'Failed to import rating row');
        errors.push(`Line ${row.line}: import failed`);
        skippedCount += 1;
      }
    }
  } else {
    const parseResult = parseFilmtipsetCsvRows(content, logger, commentRowSchema, [
      'date',
      'movie',
      'imdb',
      'text',
    ]);
    errors.push(...parseResult.errors);
    skippedCount += parseResult.errors.length;
    const dedupedRows = dedupeRowsByImdbId(parseResult.rows);
    const commentService = createCommentService({ logger });

    for (const row of dedupedRows.values()) {
      try {
        const lookupResult = await movieService.findMovieByImdbId(row.imdbId);
        if (!lookupResult.success) {
          errors.push(
            `Line ${row.line}: ${lookupResult.message} (${lookupResult.reason}) for ${row.imdbId} (${row.title})`
          );
          skippedCount += 1;
          continue;
        }

        await commentService.createComment(
          lookupResult.tmdbId,
          userId,
          row.comment,
          row.watchedAt,
          importTimestamp
        );
        await watchService.createWatchEntryIfMissing(
          lookupResult.tmdbId,
          userId,
          row.watchedAt,
          FILMTIPSET_SOURCE_COMMENTS
        );
        importedCount += 1;
      } catch (error) {
        logger.error({ err: error, row }, 'Failed to import comment row');
        errors.push(`Line ${row.line}: import failed`);
        skippedCount += 1;
      }
    }
  }

  return {
    importedCount,
    skippedCount,
    errors,
  };
}

export async function importRatingsFromFilmtipset(
  userId: number,
  content: string,
  options?: ServiceOptions
): Promise<ImportSummary> {
  return importFromFilmtipset(userId, content, 'ratings', options);
}
