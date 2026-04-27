import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export function createCommentService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'comment-service', context });

  return {
    async getCommentsForMovie(tmdbId: number) {
      const logger = localLogger('getCommentsForMovie');
      logger.debug({ tmdbId }, 'Fetching comments for movie');

      return prisma.comment.findMany({
        where: { tmdbId },
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

    async createComment(tmdbId: number, userId: number, content: string) {
      const logger = localLogger('createComment');
      logger.debug({ tmdbId, userId }, 'Creating comment');

      return prisma.comment.create({
        data: {
          tmdbId,
          userId,
          content,
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

    async deleteComment(tmdbId: number, commentId: number, userId: number) {
      const logger = localLogger('deleteComment');
      logger.debug({ tmdbId, commentId, userId }, 'Deleting comment');

      const result = await prisma.comment.deleteMany({
        where: { id: commentId, tmdbId, userId },
      });

      if (result.count === 0) {
        throw Object.assign(new Error('Comment not found'), { statusCode: 404 });
      }
    },
  };
}
