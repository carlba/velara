import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
process.env.TMDB_API_KEY = 'test-tmdb-key';
process.env.OMDB_API_KEY = 'test-omdb-key';
process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-chars!!';

interface ParsedRow {
  imdbId: string;
  score: number;
  watchedAt: Date;
  title: string;
  line: number;
}

let normalizeImdbId: (value: string) => string | null;
let parseFilmtipsetRows: (
  content: string,
  logger: ImportLogger
) => { rows: ParsedRow[]; errors: string[] };

interface ImportLogger {
  error: (...args: unknown[]) => void;
}

beforeAll(async () => {
  const importService = await import('./import-service.js');
  normalizeImdbId = importService.normalizeImdbId;
  parseFilmtipsetRows = importService.parseFilmtipsetRows;
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

    const result = parseFilmtipsetRows(content, logger);

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(['Line 1: invalid IMDB id']);
    expect(logger.error).toHaveBeenCalledWith({ line: 1, rawImdb: '455' }, 'Invalid IMDB id value');
  });
});
