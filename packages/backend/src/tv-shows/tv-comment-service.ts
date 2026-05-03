import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export function createTvCommentService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'tv-comment-service', context });

  return {
    async getCommentsForSeries(seriesTmdbId: string) {
      const logger = localLogger('getCommentsForSeries');
      logger.debug({ seriesTmdbId }, 'Fetching comments for TV series');

      return prisma.tvComment.findMany({
        where: { seriesTmdbId },
        orderBy: [{ createdAt: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });
    },

    async createComment(
      seriesTmdbId: string,
      userId: number,
      content: string,
      createdAt?: Date,
      importedAt?: Date
    ) {
      const logger = localLogger('createComment');
      logger.debug({ seriesTmdbId, userId, createdAt, importedAt }, 'Creating TV comment');

      return prisma.tvComment.create({
        data: {
          seriesTmdbId,
          userId,
          content,
          ...(createdAt ? { createdAt } : {}),
          ...(importedAt ? { importedAt } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });
    },

    async deleteComment(seriesTmdbId: string, commentId: number, userId: number) {
      const logger = localLogger('deleteComment');
      logger.debug({ seriesTmdbId, commentId, userId }, 'Deleting TV comment');

      const result = await prisma.tvComment.deleteMany({
        where: { id: commentId, seriesTmdbId, userId },
      });

      if (result.count === 0) {
        throw new HttpError('Comment not found', { statusCode: 404 });
      }
    },
  };
}
