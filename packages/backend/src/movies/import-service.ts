import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { parse } from 'csv-parse/sync';
import { LOGGER } from '../registry.js';
import { createMovieService } from './movie-service.js';
import { createRatingService } from '../ratings/rating-service.js';
import { createWatchService } from '../watch/watch-service.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export interface ImportSummary {
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

interface ParsedRow {
  imdbId: string;
  score: number;
  watchedAt: Date;
  title: string;
  line: number;
}

export function normalizeImdbId(value: string): string | null {
  const normalized = value.trim();

  if (!/^[0-9]{4,7}$/.test(normalized)) {
    return null;
  }

  return `tt${normalized.padStart(7, '0')}`;
}

export function parseFilmtipsetRows(
  content: string,
  logger: ServiceLogger
): { rows: ParsedRow[]; errors: string[] } {
  const records = parse(content, {
    delimiter: ';',
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  if (records.length === 0) {
    return { rows: [], errors: ['File content is empty'] };
  }

  const errors: string[] = [];
  const rows: ParsedRow[] = [];
  const header = records[0].map(column => column.toLowerCase());
  const hasHeader =
    header.includes('votedate') &&
    header.includes('movietitle') &&
    header.includes('imdb') &&
    header.includes('score');

  const startIndex = hasHeader ? 1 : 0;

  for (let index = startIndex; index < records.length; index += 1) {
    const rawLine = records[index];
    const lineNumber = index + 1;

    if (rawLine.length < 3 || rawLine.length > 4) {
      errors.push(`Line ${lineNumber}: expected 3 or 4 columns, got ${rawLine.length}`);
      continue;
    }

    let rawDate: string;
    let title: string;
    let imdbRaw: string;
    let scoreRaw: string;

    if (rawLine.length === 4) {
      [rawDate, title, imdbRaw, scoreRaw] = rawLine;
    } else {
      const [dateAndTitle, imdb, score] = rawLine;
      const [date, ...titleParts] = dateAndTitle.split(',');
      rawDate = date?.trim() ?? '';
      title = titleParts.join(',').trim();
      imdbRaw = imdb;
      scoreRaw = score;
    }

    const imdbId = normalizeImdbId(imdbRaw);
    const score = Number(scoreRaw);
    const watchedAt = new Date(rawDate);

    if (!imdbId) {
      logger.error({ line: lineNumber, rawImdb: imdbRaw }, 'Invalid IMDB id value');
      errors.push(`Line ${lineNumber}: invalid IMDB id`);
      continue;
    }

    if (!Number.isInteger(score) || score < 1 || score > 5) {
      errors.push(`Line ${lineNumber}: score must be an integer between 1 and 5`);
      continue;
    }

    if (Number.isNaN(watchedAt.getTime())) {
      errors.push(`Line ${lineNumber}: invalid VoteDate`);
      continue;
    }

    rows.push({ imdbId, score, watchedAt, title, line: lineNumber });
  }

  return { rows, errors };
}

export async function importRatingsFromFilmtipset(
  userId: number,
  content: string,
  options?: ServiceOptions
): Promise<ImportSummary> {
  const serviceLogger = options?.logger ?? LOGGER;
  const logger = serviceLogger.child({ module: 'import-service' });
  const { rows, errors } = parseFilmtipsetRows(content, logger);

  const movieService = createMovieService({ logger });
  const ratingService = createRatingService({ logger });
  const watchService = createWatchService({ logger });

  const dedupedRows = new Map<string, ParsedRow>();
  for (const row of rows) {
    const existing = dedupedRows.get(row.imdbId);
    if (!existing || row.watchedAt > existing.watchedAt) {
      dedupedRows.set(row.imdbId, row);
    }
  }

  let importedCount = 0;
  let skippedCount = errors.length;

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

      await ratingService.upsertRating(lookupResult.tmdbId, userId, row.score);
      await watchService.getOrCreateWatchEntry(lookupResult.tmdbId, userId, row.watchedAt);
      importedCount += 1;
    } catch (error) {
      logger.error({ err: error, row }, 'Failed to import rating row');
      errors.push(`Line ${row.line}: import failed`);
      skippedCount += 1;
    }
  }

  return {
    importedCount,
    skippedCount,
    errors,
  };
}
