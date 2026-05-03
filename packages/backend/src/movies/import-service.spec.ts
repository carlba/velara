import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { parseFilmtipsetCsvRows as ParseFilmtipsetCsvRows } from './import-service.js';
import { z } from 'zod';

const originalEnv = { ...process.env };

process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
process.env.TMDB_API_KEY = 'test-tmdb-key';
process.env.OMDB_API_KEY = 'test-omdb-key';
process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-chars!!';

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

beforeAll(async () => {
  const importService = await import('./import-service.js');
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
