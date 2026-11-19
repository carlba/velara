import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const loggerMock = {
  child: vi.fn(() => loggerMock),
  debug: vi.fn(),
} as unknown as Logger;

const findManyMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock('../registry.js', () => ({ LOGGER: loggerMock }));
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tvWatchEntry: {
      findMany: findManyMock,
    },
    tvRating: {
      findMany: findManyMock,
    },
    tvReview: {
      findUnique: findUniqueMock,
    },
  },
}));

describe('TV user data service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('sorts series watch history by watchedAt descending', async () => {
    findManyMock
      .mockResolvedValueOnce([
        {
          seasonNumber: 1,
          episodeNumber: 1,
          latestWatchedAt: new Date('2024-01-01'),
          source: 'manual',
          watchHistory: [
            { watchedAt: '2024-01-01T00:00:00.000Z', source: 'manual' },
            { watchedAt: '2023-12-31T00:00:00.000Z', source: 'manual' },
          ],
        },
        {
          seasonNumber: 1,
          episodeNumber: 2,
          latestWatchedAt: new Date('2024-02-01'),
          source: 'manual',
          watchHistory: [{ watchedAt: '2024-02-01T00:00:00.000Z', source: 'manual' }],
        },
        {
          seasonNumber: 2,
          episodeNumber: 1,
          latestWatchedAt: new Date('2024-01-15'),
          source: 'manual',
          watchHistory: [{ watchedAt: '2024-01-15T00:00:00.000Z', source: 'manual' }],
        },
      ])
      .mockResolvedValueOnce([]);
    findUniqueMock.mockResolvedValue(null);

    const { createTvUserDataService } = await import('./tv-user-data-service.js');
    const service = createTvUserDataService({ logger: loggerMock });
    const result = await service.getUserTvData('123', 42);

    expect(result.watchHistory).toEqual([
      {
        seasonNumber: 1,
        episodeNumber: 2,
        watchedAt: '2024-02-01T00:00:00.000Z',
        source: 'manual',
      },
      {
        seasonNumber: 2,
        episodeNumber: 1,
        watchedAt: '2024-01-15T00:00:00.000Z',
        source: 'manual',
      },
      {
        seasonNumber: 1,
        episodeNumber: 1,
        watchedAt: '2024-01-01T00:00:00.000Z',
        source: 'manual',
      },
      {
        seasonNumber: 1,
        episodeNumber: 1,
        watchedAt: '2023-12-31T00:00:00.000Z',
        source: 'manual',
      },
    ]);
  });

  it('maps series ids to the show-level user score only', async () => {
    findManyMock.mockResolvedValueOnce([{ seriesTmdbId: '1399', score: 9 }]);

    const { createTvUserDataService } = await import('./tv-user-data-service.js');
    const service = createTvUserDataService({ logger: loggerMock });

    const result = await service.getMyShowRatings(5, ['1399', '1400']);

    expect(result).toEqual({ '1399': 9 });
    expect(findManyMock).toHaveBeenCalledWith({
      where: { userId: 5, seasonNumber: 0, seriesTmdbId: { in: ['1399', '1400'] } },
      select: { seriesTmdbId: true, score: true },
    });
  });
});
