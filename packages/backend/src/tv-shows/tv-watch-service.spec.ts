import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const loggerMock = {
  child: vi.fn(() => loggerMock),
  debug: vi.fn(),
} as unknown as Logger;

const findUniqueMock = vi.fn();
const createWatchEntryMock = vi.fn();
const updateWatchEntryMock = vi.fn();
const createWatchHistoryMock = vi.fn();
const transactionMock = vi.fn();

vi.mock('../registry.js', () => ({ LOGGER: loggerMock }));
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tvWatchEntry: {
      findUnique: findUniqueMock,
      create: createWatchEntryMock,
      update: updateWatchEntryMock,
    },
    tvWatchHistory: {
      create: createWatchHistoryMock,
    },
    $transaction: transactionMock,
  },
}));

describe('TV watch service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('creates a new TV watch entry and history row when none exists', async () => {
    findUniqueMock.mockResolvedValue(null);
    createWatchHistoryMock.mockResolvedValue({ id: 1 });
    createWatchEntryMock.mockResolvedValue({
      seriesTmdbId: '123',
      seasonNumber: 1,
      episodeNumber: 1,
      latestWatchedAt: new Date('2024-01-01'),
    });
    transactionMock.mockImplementation(async operations => Promise.all(operations));

    const { createTvWatchService } = await import('./tv-watch-service.js');
    const service = createTvWatchService({ logger: loggerMock });

    const result = await service.markEpisodeWatched('123', 1, 1, 42, new Date('2024-01-01'));

    expect(result).toEqual({
      seriesTmdbId: '123',
      seasonNumber: 1,
      episodeNumber: 1,
      latestWatchedAt: new Date('2024-01-01'),
    });
    expect(transactionMock).toHaveBeenCalled();
    expect(createWatchHistoryMock).toHaveBeenCalledWith({
      data: {
        seriesTmdbId: '123',
        seasonNumber: 1,
        episodeNumber: 1,
        userId: 42,
        watchedAt: new Date('2024-01-01'),
        source: 'manual',
      },
    });
    expect(createWatchEntryMock).toHaveBeenCalledWith({
      data: {
        seriesTmdbId: '123',
        seasonNumber: 1,
        episodeNumber: 1,
        userId: 42,
        latestWatchedAt: new Date('2024-01-01'),
        source: 'manual',
      },
    });
  });

  it('updates the latest TV watch entry when a newer watch event arrives', async () => {
    const existingEntry = {
      seriesTmdbId: '123',
      seasonNumber: 1,
      episodeNumber: 1,
      userId: 42,
      latestWatchedAt: new Date('2023-01-01'),
    };
    findUniqueMock.mockResolvedValue(existingEntry);
    createWatchHistoryMock.mockResolvedValue({});
    updateWatchEntryMock.mockResolvedValue({
      ...existingEntry,
      latestWatchedAt: new Date('2024-01-01'),
    });

    const { createTvWatchService } = await import('./tv-watch-service.js');
    const service = createTvWatchService({ logger: loggerMock });

    const result = await service.markEpisodeWatched('123', 1, 1, 42, new Date('2024-01-01'));

    expect(result).toEqual({
      ...existingEntry,
      latestWatchedAt: new Date('2024-01-01'),
    });
    expect(createWatchHistoryMock).toHaveBeenCalledWith({
      data: {
        seriesTmdbId: '123',
        seasonNumber: 1,
        episodeNumber: 1,
        userId: 42,
        watchedAt: new Date('2024-01-01'),
        source: 'manual',
      },
    });
    expect(updateWatchEntryMock).toHaveBeenCalledWith({
      where: {
        seriesTmdbId_seasonNumber_episodeNumber_userId: {
          seriesTmdbId: '123',
          seasonNumber: 1,
          episodeNumber: 1,
          userId: 42,
        },
      },
      data: { latestWatchedAt: new Date('2024-01-01'), source: 'manual' },
    });
  });
});
