import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { LOGGER } from '../registry.js';
import { createCommentService } from '../comments/comment-service.js';
import { createMovieService } from './movie-service.js';
import { createRatingService } from '../ratings/rating-service.js';
import { createWatchService } from '../watch/watch-service.js';

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

        await ratingService.upsertRating(lookupResult.tmdbId, userId, row.score, importTimestamp);
        await watchService.createWatchEntryIfMissing(lookupResult.tmdbId, userId, row.watchedAt);
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
        await watchService.createWatchEntryIfMissing(lookupResult.tmdbId, userId, row.watchedAt);
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
