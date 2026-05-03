import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const loggerMock = {
  child: vi.fn(() => loggerMock),
  debug: vi.fn(),
} as unknown as Logger;

const upsertMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock('../registry.js', () => ({ LOGGER: loggerMock }));
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    rating: { upsert: upsertMock, deleteMany: deleteManyMock },
  },
}));

describe('rating service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('upserts a rating with ratedAt and importedAt on create', async () => {
    const rating = {
      id: 1,
      tmdbId: 123,
      userId: 5,
      score: 4,
      ratedAt: new Date('2024-05-01T12:00:00Z'),
      importedAt: new Date('2024-06-01T12:00:00Z'),
    };
    upsertMock.mockResolvedValue(rating);

    const { createRatingService } = await import('./rating-service.js');
    const service = createRatingService({ logger: loggerMock });
    const ratedAt = new Date('2024-05-01T12:00:00Z');
    const importedAt = new Date('2024-06-01T12:00:00Z');

    expect(await service.upsertRating(123, 5, 4, ratedAt, importedAt)).toBe(rating);
    expect(upsertMock).toHaveBeenCalledWith({
      where: { tmdbId_userId: { tmdbId: 123, userId: 5 } },
      update: { score: 4, source: 'manual', ratedAt, importedAt },
      create: {
        tmdbId: 123,
        userId: 5,
        score: 4,
        source: 'manual',
        ratedAt,
        importedAt,
      },
    });
  });

  it('upserts a rating without importedAt when called from UI', async () => {
    const rating = { id: 2, tmdbId: 123, userId: 5, score: 5 };
    upsertMock.mockResolvedValue(rating);

    const { createRatingService } = await import('./rating-service.js');
    const service = createRatingService({ logger: loggerMock });

    expect(await service.upsertRating(123, 5, 5)).toBe(rating);
    expect(upsertMock).toHaveBeenCalledWith({
      where: { tmdbId_userId: { tmdbId: 123, userId: 5 } },
      update: { score: 5, source: 'manual' },
      create: { tmdbId: 123, userId: 5, score: 5, source: 'manual' },
    });
  });

  it('deletes a rating', async () => {
    deleteManyMock.mockResolvedValue({ count: 1 });

    const { createRatingService } = await import('./rating-service.js');
    const service = createRatingService({ logger: loggerMock });

    await service.deleteRating(123, 5);
    expect(deleteManyMock).toHaveBeenCalledWith({ where: { tmdbId: 123, userId: 5 } });
  });
});
