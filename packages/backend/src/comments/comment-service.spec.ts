import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const loggerMock = {
  child: vi.fn(() => loggerMock),
  debug: vi.fn(),
} as unknown as Logger;

const findManyMock = vi.fn();
const createMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock('../registry.js', () => ({ LOGGER: loggerMock }));
vi.mock('../lib/prisma.js', () => ({
  prisma: { comment: { findMany: findManyMock, create: createMock, deleteMany: deleteManyMock } },
}));

describe('comment service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns comments for a movie', async () => {
    const comments = [
      {
        id: 1,
        tmdbId: 123,
        content: 'Nice',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: 2, username: 'alice' },
      },
    ];
    findManyMock.mockResolvedValue(comments);

    const { createCommentService } = await import('./comment-service.js');
    const service = createCommentService({ logger: loggerMock });

    expect(await service.getCommentsForMovie(123)).toBe(comments);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { tmdbId: 123 },
      orderBy: [{ createdAt: 'desc' }],
      include: { user: { select: { id: true, username: true } } },
    });
  });

  it('creates a comment', async () => {
    const comment = {
      id: 11,
      tmdbId: 123,
      content: 'Great',
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: 5, username: 'bob' },
    };
    createMock.mockResolvedValue(comment);

    const { createCommentService } = await import('./comment-service.js');
    const service = createCommentService({ logger: loggerMock });

    expect(await service.createComment(123, 5, 'Great')).toBe(comment);
    expect(createMock).toHaveBeenCalledWith({
      data: { tmdbId: 123, userId: 5, content: 'Great' },
      include: { user: { select: { id: true, username: true } } },
    });
  });

  it('throws when deleteComment does not delete any rows', async () => {
    deleteManyMock.mockResolvedValue({ count: 0 });

    const { createCommentService } = await import('./comment-service.js');
    const service = createCommentService({ logger: loggerMock });

    await expect(service.deleteComment(123, 77, 5)).rejects.toMatchObject({
      message: 'Comment not found',
    });
    expect(deleteManyMock).toHaveBeenCalledWith({ where: { id: 77, tmdbId: 123, userId: 5 } });
  });
});
