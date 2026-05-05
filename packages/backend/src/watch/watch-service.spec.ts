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
    watchEntry: {
      findUnique: findUniqueMock,
      create: createWatchEntryMock,
      update: updateWatchEntryMock,
    },
    watchHistory: {
      create: createWatchHistoryMock,
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

  it('creates a new watch entry and history row when none exists', async () => {
    findUniqueMock.mockResolvedValue(null);
    createWatchHistoryMock.mockResolvedValue({ id: 1 });
    createWatchEntryMock.mockResolvedValue({
      tmdbId: 12,
      userId: 34,
      latestWatchedAt: new Date('2024-01-01'),
    });
    transactionMock.mockImplementation(async operations => Promise.all(operations));

    const { createWatchService } = await import('./watch-service.js');
    const service = createWatchService({ logger: loggerMock });

    const result = await service.getOrCreateWatchEntry(12, 34, new Date('2024-01-01'));

    expect(result).toEqual({ tmdbId: 12, userId: 34, latestWatchedAt: new Date('2024-01-01') });
    expect(transactionMock).toHaveBeenCalled();
    expect(createWatchHistoryMock).toHaveBeenCalledWith({
      data: { tmdbId: 12, userId: 34, watchedAt: new Date('2024-01-01'), source: 'manual' },
    });
    expect(createWatchEntryMock).toHaveBeenCalledWith({
      data: { tmdbId: 12, userId: 34, latestWatchedAt: new Date('2024-01-01'), source: 'manual' },
    });
  });

  it('updates the latest watch entry when a newer watch event arrives', async () => {
    const existingEntry = { tmdbId: 12, userId: 34, latestWatchedAt: new Date('2023-01-01') };
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
      data: { tmdbId: 12, userId: 34, watchedAt: new Date('2024-01-01'), source: 'manual' },
    });
    expect(updateWatchEntryMock).toHaveBeenCalledWith({
      where: { tmdbId_userId: { tmdbId: 12, userId: 34 } },
      data: { latestWatchedAt: new Date('2024-01-01'), source: 'manual' },
    });
  });
});
