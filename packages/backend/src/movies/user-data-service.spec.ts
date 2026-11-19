import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const loggerMock = {
  child: vi.fn(() => loggerMock),
  debug: vi.fn(),
} as unknown as Logger;

const ratingFindManyMock = vi.fn();
const watchEntryFindManyMock = vi.fn();
const reviewFindManyMock = vi.fn();
const commentFindManyMock = vi.fn();

vi.mock('../registry.js', () => ({ LOGGER: loggerMock }));
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    rating: { findMany: ratingFindManyMock },
    watchEntry: { findMany: watchEntryFindManyMock },
    review: { findMany: reviewFindManyMock },
    comment: { findMany: commentFindManyMock },
  },
}));

describe('user data service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns TMDB ids for commented movies', async () => {
    commentFindManyMock.mockResolvedValue([{ tmdbId: 42 }, { tmdbId: 99 }]);

    const { createUserDataService } = await import('./user-data-service.js');
    const service = createUserDataService({ logger: loggerMock });

    const result = await service.getFilteredTmdbIds(5, ['commented']);

    expect(result).toEqual([42, 99]);
    expect(commentFindManyMock).toHaveBeenCalledWith({
      where: { userId: 5 },
      select: { tmdbId: true },
    });
  });

  it('can intersect commented and watched filters when sorting by watched_date', async () => {
    watchEntryFindManyMock.mockResolvedValue([{ tmdbId: 1 }, { tmdbId: 2 }]);
    commentFindManyMock.mockResolvedValue([{ tmdbId: 1 }, { tmdbId: 3 }]);

    const { createUserDataService } = await import('./user-data-service.js');
    const service = createUserDataService({ logger: loggerMock });

    const result = await service.getFilteredTmdbIds(5, ['watched', 'commented'], 'watched_date');

    expect(result).toEqual([1]);
  });

  it('maps tmdb ids to the user score for rated movies only', async () => {
    ratingFindManyMock.mockResolvedValue([
      { tmdbId: 42, score: 8 },
      { tmdbId: 7, score: 3 },
    ]);

    const { createUserDataService } = await import('./user-data-service.js');
    const service = createUserDataService({ logger: loggerMock });

    const result = await service.getMyRatings(5, [42, 7, 100]);

    expect(result).toEqual({ 42: 8, 7: 3 });
    expect(ratingFindManyMock).toHaveBeenCalledWith({
      where: { userId: 5, tmdbId: { in: [42, 7, 100] } },
      select: { tmdbId: true, score: true },
    });
  });

  it('returns an empty map when none of the movies are rated', async () => {
    ratingFindManyMock.mockResolvedValue([]);

    const { createUserDataService } = await import('./user-data-service.js');
    const service = createUserDataService({ logger: loggerMock });

    expect(await service.getMyRatings(5, [1])).toEqual({});
  });
});
