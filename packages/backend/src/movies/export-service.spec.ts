import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const loggerMock = {
  child: vi.fn(() => loggerMock),
  debug: vi.fn(),
} as unknown as Logger;

const watchEntryFindManyMock = vi.fn();
const ratingFindManyMock = vi.fn();

vi.mock('../registry.js', () => ({ LOGGER: loggerMock }));
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    watchEntry: { findMany: watchEntryFindManyMock },
    rating: { findMany: ratingFindManyMock },
  },
}));

describe('export service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    watchEntryFindManyMock.mockResolvedValue([]);
    ratingFindManyMock.mockResolvedValue([]);
  });

  it('flags rewatches across a 3-viewing watch history and leaves Rating10 empty', async () => {
    watchEntryFindManyMock.mockResolvedValue([
      {
        tmdbId: 1,
        watchHistory: [
          { watchedAt: new Date('2024-01-01') },
          { watchedAt: new Date('2024-02-01') },
          { watchedAt: new Date('2024-03-01') },
        ],
      },
    ]);

    const { createExportService } = await import('./export-service.js');
    const rows = await createExportService({ logger: loggerMock }).buildLetterboxdRows(5);

    expect(rows).toEqual([
      {
        tmdbID: 1,
        Title: '',
        Year: '',
        WatchedDate: '2024-01-01',
        Rewatch: 'false',
        Rating10: '',
      },
      {
        tmdbID: 1,
        Title: '',
        Year: '',
        WatchedDate: '2024-02-01',
        Rewatch: 'true',
        Rating10: '',
      },
      {
        tmdbID: 1,
        Title: '',
        Year: '',
        WatchedDate: '2024-03-01',
        Rewatch: 'true',
        Rating10: '',
      },
    ]);
  });

  it('attaches the rating to the single diary row for a watched-and-rated movie', async () => {
    watchEntryFindManyMock.mockResolvedValue([
      { tmdbId: 2, watchHistory: [{ watchedAt: new Date('2024-01-10') }] },
    ]);
    ratingFindManyMock.mockResolvedValue([
      { tmdbId: 2, score: 8, ratedAt: new Date('2024-01-15'), createdAt: new Date('2024-01-15') },
    ]);

    const { createExportService } = await import('./export-service.js');
    const rows = await createExportService({ logger: loggerMock }).buildLetterboxdRows(5);

    expect(rows).toEqual([
      {
        tmdbID: 2,
        Title: '',
        Year: '',
        WatchedDate: '2024-01-10',
        Rewatch: 'false',
        Rating10: '8',
      },
    ]);
  });

  it('attaches the rating to the viewing closest in time when a movie was watched more than once', async () => {
    watchEntryFindManyMock.mockResolvedValue([
      {
        tmdbId: 2,
        watchHistory: [
          { watchedAt: new Date('2024-01-01') },
          { watchedAt: new Date('2024-06-01') },
        ],
      },
    ]);
    ratingFindManyMock.mockResolvedValue([
      { tmdbId: 2, score: 8, ratedAt: new Date('2024-06-05'), createdAt: new Date('2024-06-05') },
    ]);

    const { createExportService } = await import('./export-service.js');
    const rows = await createExportService({ logger: loggerMock }).buildLetterboxdRows(5);

    expect(rows).toEqual([
      {
        tmdbID: 2,
        Title: '',
        Year: '',
        WatchedDate: '2024-01-01',
        Rewatch: 'false',
        Rating10: '',
      },
      {
        tmdbID: 2,
        Title: '',
        Year: '',
        WatchedDate: '2024-06-01',
        Rewatch: 'true',
        Rating10: '8',
      },
    ]);
  });

  it('emits a standalone rating row with the rated date for a rated-but-unwatched movie', async () => {
    ratingFindManyMock.mockResolvedValue([
      { tmdbId: 3, score: 6, ratedAt: new Date('2024-05-20'), createdAt: new Date('2024-05-20') },
    ]);

    const { createExportService } = await import('./export-service.js');
    const rows = await createExportService({ logger: loggerMock }).buildLetterboxdRows(5);

    expect(rows).toEqual([
      {
        tmdbID: 3,
        Title: '',
        Year: '',
        WatchedDate: '2024-05-20',
        Rewatch: '',
        Rating10: '6',
      },
    ]);
  });

  it('falls back to createdAt for the rating date when ratedAt is null', async () => {
    ratingFindManyMock.mockResolvedValue([
      { tmdbId: 7, score: 9, ratedAt: null, createdAt: new Date('2023-11-02') },
    ]);

    const { createExportService } = await import('./export-service.js');
    const rows = await createExportService({ logger: loggerMock }).buildLetterboxdRows(5);

    expect(rows).toEqual([
      {
        tmdbID: 7,
        Title: '',
        Year: '',
        WatchedDate: '2023-11-02',
        Rewatch: '',
        Rating10: '9',
      },
    ]);
  });

  it('emits only diary rows for a watched-but-never-rated movie', async () => {
    watchEntryFindManyMock.mockResolvedValue([
      { tmdbId: 4, watchHistory: [{ watchedAt: new Date('2024-04-04') }] },
    ]);

    const { createExportService } = await import('./export-service.js');
    const rows = await createExportService({ logger: loggerMock }).buildLetterboxdRows(5);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tmdbID: 4, Rating10: '' });
  });

  it('does not cross-contaminate rows between multiple distinct movies', async () => {
    watchEntryFindManyMock.mockResolvedValue([
      { tmdbId: 1, watchHistory: [{ watchedAt: new Date('2024-01-01') }] },
      { tmdbId: 2, watchHistory: [{ watchedAt: new Date('2024-02-01') }] },
    ]);
    ratingFindManyMock.mockResolvedValue([
      { tmdbId: 2, score: 5, ratedAt: new Date('2024-02-05'), createdAt: new Date('2024-02-05') },
    ]);

    const { createExportService } = await import('./export-service.js');
    const rows = await createExportService({ logger: loggerMock }).buildLetterboxdRows(5);

    expect(rows).toHaveLength(2);
    expect(rows.filter(row => row.tmdbID === 1)).toHaveLength(1);
    expect(rows.filter(row => row.tmdbID === 2)).toHaveLength(1);
    expect(rows.find(row => row.tmdbID === 2)).toMatchObject({ Rating10: '5' });
  });

  it('produces a header-only CSV when there is no watch history and no ratings', async () => {
    const { createExportService } = await import('./export-service.js');
    const csv = await createExportService({ logger: loggerMock }).exportLetterboxdCsv(5);

    expect(csv).toBe('tmdbID,Title,Year,WatchedDate,Rewatch,Rating10\n');
  });

  it('emits the exact header row', async () => {
    const { createExportService } = await import('./export-service.js');
    const csv = await createExportService({ logger: loggerMock }).exportLetterboxdCsv(5);

    expect(csv.split('\n')[0]).toBe('tmdbID,Title,Year,WatchedDate,Rewatch,Rating10');
  });
});
