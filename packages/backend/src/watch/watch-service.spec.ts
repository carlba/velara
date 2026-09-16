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
const findFirstWatchHistoryMock = vi.fn();
const transactionMock = vi.fn();

vi.mock('../registry.js', () => ({ LOGGER: loggerMock }));
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    watchEntry: {
      findUnique: findUniqueMock,
      create: createWatchEntryMock,
      update: updateWatchEntryMock,
    },
    watchHistory: {
      create: createWatchHistoryMock,
      findFirst: findFirstWatchHistoryMock,
    },
    $transaction: transactionMock,
  },
}));

describe('watch service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns an existing watch entry and records a history event when the new watch date is not later', async () => {
    const existingEntry = { tmdbId: 12, userId: 34, latestWatchedAt: new Date('2023-01-01') };
    findUniqueMock.mockResolvedValue(existingEntry);
    createWatchHistoryMock.mockResolvedValue({});

    const { createWatchService } = await import('./watch-service.js');
    const service = createWatchService({ logger: loggerMock });

    const result = await service.getOrCreateWatchEntry(12, 34, new Date('2022-12-31'));

    expect(result).toBe(existingEntry);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { tmdbId_userId: { tmdbId: 12, userId: 34 } },
    });
    expect(createWatchHistoryMock).toHaveBeenCalledWith({
      data: { tmdbId: 12, userId: 34, watchedAt: new Date('2022-12-31'), source: 'manual' },
    });
    expect(updateWatchEntryMock).not.toHaveBeenCalled();
  });

  it('creates a new watch entry and nested history row when none exists', async () => {
    findUniqueMock.mockResolvedValue(null);
    createWatchEntryMock.mockResolvedValue({
      tmdbId: 12,
      userId: 34,
      latestWatchedAt: new Date('2024-01-01'),
    });

    const { createWatchService } = await import('./watch-service.js');
    const service = createWatchService({ logger: loggerMock });

    const result = await service.getOrCreateWatchEntry(12, 34, new Date('2024-01-01'));

    expect(result).toEqual({ tmdbId: 12, userId: 34, latestWatchedAt: new Date('2024-01-01') });
    expect(createWatchHistoryMock).not.toHaveBeenCalled();
    expect(createWatchEntryMock).toHaveBeenCalledWith({
      data: {
        tmdbId: 12,
        userId: 34,
        latestWatchedAt: new Date('2024-01-01'),
        source: 'manual',
        watchHistory: {
          create: [{ tmdbId: 12, userId: 34, watchedAt: new Date('2024-01-01'), source: 'manual' }],
        },
      },
    });
  });

  it('updates the latest watch entry when a newer watch event arrives', async () => {
    const existingEntry = {
      id: 99,
      tmdbId: 12,
      userId: 34,
      latestWatchedAt: new Date('2023-01-01'),
    };
    findUniqueMock.mockResolvedValue(existingEntry);
    createWatchHistoryMock.mockResolvedValue({});
    updateWatchEntryMock.mockResolvedValue({
      tmdbId: 12,
      userId: 34,
      latestWatchedAt: new Date('2024-01-01'),
    });

    const { createWatchService } = await import('./watch-service.js');
    const service = createWatchService({ logger: loggerMock });

    const result = await service.getOrCreateWatchEntry(12, 34, new Date('2024-01-01'));

    expect(result).toEqual({ tmdbId: 12, userId: 34, latestWatchedAt: new Date('2024-01-01') });
    expect(createWatchHistoryMock).toHaveBeenCalledWith({
      data: {
        tmdbId: 12,
        userId: 34,
        watchedAt: new Date('2024-01-01'),
        source: 'manual',
        watchEntryId: 99,
      },
    });
    expect(updateWatchEntryMock).toHaveBeenCalledWith({
      where: { tmdbId_userId: { tmdbId: 12, userId: 34 } },
      data: { latestWatchedAt: new Date('2024-01-01'), source: 'manual' },
    });
  });

  describe('createWatchEntryIfMissingForDay', () => {
    it('is a no-op when a watch history row already exists for that day', async () => {
      const existingHistoryRow = { id: 5, tmdbId: 12, userId: 34, watchedAt: new Date('2024-04-15T10:00:00Z') };
      findFirstWatchHistoryMock.mockResolvedValue(existingHistoryRow);

      const { createWatchService } = await import('./watch-service.js');
      const service = createWatchService({ logger: loggerMock });

      const watchedAt = new Date('2024-04-15T22:00:00Z');
      const result = await service.createWatchEntryIfMissingForDay(12, 34, watchedAt);

      const expectedDayStart = new Date(watchedAt);
      expectedDayStart.setHours(0, 0, 0, 0);
      const expectedDayEnd = new Date(expectedDayStart);
      expectedDayEnd.setDate(expectedDayEnd.getDate() + 1);

      expect(result).toBe(existingHistoryRow);
      expect(findFirstWatchHistoryMock).toHaveBeenCalledWith({
        where: {
          tmdbId: 12,
          userId: 34,
          watchedAt: { gte: expectedDayStart, lt: expectedDayEnd },
        },
      });
      expect(findUniqueMock).not.toHaveBeenCalled();
      expect(createWatchEntryMock).not.toHaveBeenCalled();
      expect(createWatchHistoryMock).not.toHaveBeenCalled();
    });

    it('creates a new watch entry when no history exists for that day and no entry exists yet', async () => {
      findFirstWatchHistoryMock.mockResolvedValue(null);
      findUniqueMock.mockResolvedValue(null);
      createWatchEntryMock.mockResolvedValue({
        tmdbId: 12,
        userId: 34,
        latestWatchedAt: new Date('2024-04-15T22:00:00Z'),
      });

      const { createWatchService } = await import('./watch-service.js');
      const service = createWatchService({ logger: loggerMock });

      const result = await service.createWatchEntryIfMissingForDay(
        12,
        34,
        new Date('2024-04-15T22:00:00Z')
      );

      expect(result).toEqual({
        tmdbId: 12,
        userId: 34,
        latestWatchedAt: new Date('2024-04-15T22:00:00Z'),
      });
      expect(createWatchEntryMock).toHaveBeenCalledWith({
        data: {
          tmdbId: 12,
          userId: 34,
          latestWatchedAt: new Date('2024-04-15T22:00:00Z'),
          source: 'manual',
          watchHistory: {
            create: [
              { tmdbId: 12, userId: 34, watchedAt: new Date('2024-04-15T22:00:00Z'), source: 'manual' },
            ],
          },
        },
      });
    });

    it('appends a history row to an existing entry when no history exists yet for that day', async () => {
      const existingEntry = {
        id: 99,
        tmdbId: 12,
        userId: 34,
        latestWatchedAt: new Date('2023-01-01'),
      };
      findFirstWatchHistoryMock.mockResolvedValue(null);
      findUniqueMock.mockResolvedValue(existingEntry);
      createWatchHistoryMock.mockResolvedValue({});
      updateWatchEntryMock.mockResolvedValue({
        tmdbId: 12,
        userId: 34,
        latestWatchedAt: new Date('2024-04-15T22:00:00Z'),
      });

      const { createWatchService } = await import('./watch-service.js');
      const service = createWatchService({ logger: loggerMock });

      const result = await service.createWatchEntryIfMissingForDay(
        12,
        34,
        new Date('2024-04-15T22:00:00Z')
      );

      expect(result).toEqual({
        tmdbId: 12,
        userId: 34,
        latestWatchedAt: new Date('2024-04-15T22:00:00Z'),
      });
      expect(createWatchHistoryMock).toHaveBeenCalledWith({
        data: {
          tmdbId: 12,
          userId: 34,
          watchedAt: new Date('2024-04-15T22:00:00Z'),
          source: 'manual',
          watchEntryId: 99,
        },
      });
      expect(updateWatchEntryMock).toHaveBeenCalledWith({
        where: { tmdbId_userId: { tmdbId: 12, userId: 34 } },
        data: { latestWatchedAt: new Date('2024-04-15T22:00:00Z'), source: 'manual' },
      });
    });
  });
});
