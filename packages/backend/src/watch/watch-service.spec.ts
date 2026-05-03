import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const loggerMock = {
  child: vi.fn(() => loggerMock),
  debug: vi.fn(),
} as unknown as Logger;

const findUniqueMock = vi.fn();
const createMock = vi.fn();

vi.mock('../registry.js', () => ({ LOGGER: loggerMock }));
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    watchEntry: { findUnique: findUniqueMock, create: createMock },
  },
}));

describe('watch service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns an existing watch entry instead of updating it', async () => {
    const existingEntry = { tmdbId: 12, userId: 34, watchedAt: new Date('2023-01-01') };
    findUniqueMock.mockResolvedValue(existingEntry);

    const { createWatchService } = await import('./watch-service.js');
    const service = createWatchService({ logger: loggerMock });

    const result = await service.createWatchEntryIfMissing(12, 34, new Date('2024-01-01'));

    expect(result).toBe(existingEntry);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { tmdbId_userId: { tmdbId: 12, userId: 34 } },
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('creates a new watch entry when none exists', async () => {
    findUniqueMock.mockResolvedValue(null);
    const createdEntry = { tmdbId: 12, userId: 34, watchedAt: new Date('2024-01-01') };
    createMock.mockResolvedValue(createdEntry);

    const { createWatchService } = await import('./watch-service.js');
    const service = createWatchService({ logger: loggerMock });

    const result = await service.createWatchEntryIfMissing(12, 34, new Date('2024-01-01'));

    expect(result).toBe(createdEntry);
    expect(createMock).toHaveBeenCalledWith({
      data: { tmdbId: 12, userId: 34, watchedAt: new Date('2024-01-01'), source: 'manual' },
    });
  });
});
