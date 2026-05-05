import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { parseFilmtipsetCsvRows as ParseFilmtipsetCsvRows } from './import-service.js';
import { z } from 'zod';

const originalEnv = { ...process.env };

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
process.env.TMDB_API_KEY = 'test-tmdb-key';
process.env.OMDB_API_KEY = 'test-omdb-key';
process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-chars!!';

const findMovieByImdbIdMock = vi.fn();
const upsertRatingMock = vi.fn();
const getOrCreateWatchEntryMock = vi.fn();
const createWatchEntryIfMissingMock = vi.fn();

vi.mock('./movie-service.js', () => ({
  createMovieService: () => ({ findMovieByImdbId: findMovieByImdbIdMock }),
}));
vi.mock('../ratings/rating-service.js', () => ({
  createRatingService: () => ({ upsertRating: upsertRatingMock }),
}));
vi.mock('../watch/watch-service.js', () => ({
  createWatchService: () => ({
    getOrCreateWatchEntry: getOrCreateWatchEntryMock,
    createWatchEntryIfMissing: createWatchEntryIfMissingMock,
  }),
}));

let importService: typeof import('./import-service.js');

interface RatingRow {
  imdbId: string;
  score: number;
  watchedAt: Date;
  title: string;
}

interface CommentRow {
  imdbId: string;
  watchedAt: Date;
  title: string;
  comment: string;
}

let normalizeImdbId: (value: string) => string | null;
let parseFilmtipsetCsvRows: typeof ParseFilmtipsetCsvRows;
let ratingRowSchema: z.ZodType<{ imdbId: string; score: number; watchedAt: Date; title: string }>;
let commentRowSchema: z.ZodType<{
  imdbId: string;
  watchedAt: Date;
  title: string;
  comment: string;
}>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  importService = await import('./import-service.js');
  normalizeImdbId = importService.normalizeImdbId;
  parseFilmtipsetCsvRows = importService.parseFilmtipsetCsvRows;
  ratingRowSchema = importService.ratingRowSchema;
  commentRowSchema = importService.commentRowSchema;
});

afterAll(() => {
  Object.assign(process.env, originalEnv);
});

describe('import service helpers', () => {
  it('normalizes a 6-digit numeric value into a valid IMDB id', () => {
    expect(normalizeImdbId('455590')).toBe('tt0455590');
  });

  it('returns null for values shorter than 4 digits or longer than 7 digits', () => {
    expect(normalizeImdbId('455')).toBeNull();
    expect(normalizeImdbId('abc455590')).toBeNull();
    expect(normalizeImdbId('45559078')).toBeNull();
  });

  it('normalizes a 4-digit numeric value into a valid IMDB id', () => {
    expect(normalizeImdbId('1234')).toBe('tt0001234');
  });

  it('normalizes a 7-digit numeric value into a valid IMDB id', () => {
    expect(normalizeImdbId('4500000')).toBe('tt4500000');
  });

  it('logs an error when a parsed row contains an invalid IMDB id', () => {
    const logger = { error: vi.fn() };
    const content = '2024-01-01;Example Movie;455;5';

    const result = parseFilmtipsetCsvRows<RatingRow>(content, logger, ratingRowSchema, [
      'votedate',
      'movietitle',
      'imdb',
      'score',
    ]);

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      'Line 1: [{"origin":"string","code":"invalid_format","format":"regex","pattern":"/^[0-9]{4,7}$/","path":[2],"message":"invalid IMDB id"}]',
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      { line: 1, rawImdb: '455', issues: expect.any(Array) },
      'Row validation failed'
    );
  });

  it('parses Filmtipset comment rows with a header', () => {
    const logger = { error: vi.fn() };
    const content =
      'Date;Movie;IMDB;Text\n2018-05-20;Captain Fantastic - En annorlunda pappa;3553976;"Tänkvärd film"';

    const result = parseFilmtipsetCsvRows<CommentRow>(content, logger, commentRowSchema, [
      'date',
      'movie',
      'imdb',
      'text',
    ]);

    expect(result.rows).toEqual([
      {
        imdbId: 'tt3553976',
        title: 'Captain Fantastic - En annorlunda pappa',
        watchedAt: new Date('2018-05-20'),
        comment: 'Tänkvärd film',
        line: 2,
      },
    ]);
    expect(result.errors).toEqual([]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('parses Filmtipset rating rows when date and title are comma-separated', () => {
    const logger = { error: vi.fn() };
    const content = 'VoteDate;MovieTitle;IMDB;Score\n2021-07-03,1917;8579674;3';

    const result = parseFilmtipsetCsvRows<RatingRow>(content, logger, ratingRowSchema, [
      'votedate',
      'movietitle',
      'imdb',
      'score',
    ]);

    expect(result.rows).toEqual([
      {
        imdbId: 'tt8579674',
        title: '1917',
        watchedAt: new Date('2021-07-03'),
        score: 3,
        line: 2,
      },
    ]);
    expect(result.errors).toEqual([]);
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('Trakt import service', () => {
  it('imports ratings and watch history from a valid Trakt JSON export', async () => {
    findMovieByImdbIdMock.mockResolvedValue({ success: true, tmdbId: 123 });
    upsertRatingMock.mockResolvedValue({});
    createWatchEntryIfMissingMock.mockResolvedValue({});

    const { importFromTrakt } = importService;

    const content = JSON.stringify({
      ratings: [
        {
          rated_at: '2024-05-01T12:00:00Z',
          rating: 8,
          type: 'movie',
          movie: {
            title: 'Example Movie',
            year: 2024,
            ids: { tmdb: 123, imdb: 'tt1234567' },
          },
        },
      ],
      history: [
        {
          id: 1,
          watched_at: '2024-04-15T20:00:00Z',
          action: 'watch',
          type: 'movie',
          movie: {
            title: 'Example Movie',
            year: 2024,
            ids: { tmdb: 123, imdb: 'tt1234567' },
          },
        },
      ],
    });

    const summary = await importFromTrakt(1, content);

    expect(summary.importedCount).toBe(2);
    expect(summary.skippedCount).toBe(0);
    expect(summary.errors).toEqual([]);
    expect(upsertRatingMock).toHaveBeenCalledWith(
      123,
      1,
      8,
      expect.any(Date),
      expect.any(Date),
      'trakt'
    );
    expect(getOrCreateWatchEntryMock).toHaveBeenCalledWith(
      123,
      1,
      new Date('2024-04-15T20:00:00Z'),
      'trakt'
    );
  });

  it('returns an error summary for invalid Trakt JSON content', async () => {
    const { importFromTrakt } = importService;

    const summary = await importFromTrakt(1, '{ invalid json');

    expect(summary.importedCount).toBe(0);
    expect(summary.skippedCount).toBe(0);
    expect(summary.errors).toEqual(['Invalid JSON content']);
  });
});
