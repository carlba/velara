import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

type ListItemInput =
  | { type: 'movie'; movieTmdbId: number }
  | { type: 'series'; seriesTmdbId: string }
  | { type: 'season'; seriesTmdbId: string; seasonNumber: number }
  | {
      type: 'episode';
      seriesTmdbId: string;
      seasonNumber: number;
      episodeNumber: number;
    };

export function createListService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) => serviceLogger.child({ module: 'list-service', context });

  async function ensureOwnedList(listId: number, userId: number) {
    const logger = localLogger('ensureOwnedList');
    logger.debug({ listId, userId }, 'Checking list ownership');

    const list = await prisma.list.findUnique({
      where: { id: listId },
      select: { id: true, creatorId: true },
    });

    if (list?.creatorId !== userId) {
      throw new HttpError('List not found', { statusCode: 404 });
    }

    return list;
  }

  return {
    async getLists(userId: number | undefined, mine = false) {
      const logger = localLogger('getLists');
      logger.debug({ mine, userId }, 'Fetching lists');

      const where = mine && userId ? { creatorId: userId } : undefined;

      return prisma.list.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          description: true,
          creator: { select: { id: true, username: true } },
          createdAt: true,
          updatedAt: true,
          _count: { select: { items: true } },
        },
      });
    },

    async getListById(listId: number) {
      const logger = localLogger('getListById');
      logger.debug({ listId }, 'Fetching list details');

      const list = await prisma.list.findUnique({
        where: { id: listId },
        include: {
          creator: { select: { id: true, username: true } },
          items: true,
        },
      });

      if (!list) {
        throw new HttpError('List not found', { statusCode: 404 });
      }

      return list;
    },

    async createList(title: string, description: string | undefined, userId: number) {
      const logger = localLogger('createList');
      logger.debug({ title, userId }, 'Creating list');

      return prisma.list.create({
        data: {
          title,
          description,
          creatorId: userId,
        },
        include: {
          creator: { select: { id: true, username: true } },
        },
      });
    },

    async updateList(
      listId: number,
      updates: { title?: string; description?: string },
      userId: number
    ) {
      const logger = localLogger('updateList');
      logger.debug({ listId, updates, userId }, 'Updating list');

      const data: { title?: string; description?: string | null } = {};
      if (updates.title !== undefined) {
        data.title = updates.title;
      }
      if (updates.description !== undefined) {
        data.description = updates.description;
      }

      const result = await prisma.list.updateMany({
        where: { id: listId, creatorId: userId },
        data,
      });

      if (result.count === 0) {
        throw new HttpError('List not found', { statusCode: 404 });
      }

      return prisma.list.findUnique({
        where: { id: listId },
        include: { creator: { select: { id: true, username: true } } },
      });
    },

    async deleteList(listId: number, userId: number) {
      const logger = localLogger('deleteList');
      logger.debug({ listId, userId }, 'Deleting list');

      const result = await prisma.list.deleteMany({ where: { id: listId, creatorId: userId } });

      if (result.count === 0) {
        throw new HttpError('List not found', { statusCode: 404 });
      }
    },

    async addItem(listId: number, item: ListItemInput, userId: number) {
      const logger = localLogger('addItem');
      logger.debug({ listId, item, userId }, 'Adding item to list');

      await ensureOwnedList(listId, userId);

      return prisma.listItem.create({
        data: {
          listId,
          type: item.type,
          ...(item.type === 'movie' ? { movieTmdbId: item.movieTmdbId } : {}),
          ...(item.type === 'series' ? { seriesTmdbId: item.seriesTmdbId } : {}),
          ...(item.type === 'season'
            ? { seriesTmdbId: item.seriesTmdbId, seasonNumber: item.seasonNumber }
            : {}),
          ...(item.type === 'episode'
            ? {
                seriesTmdbId: item.seriesTmdbId,
                seasonNumber: item.seasonNumber,
                episodeNumber: item.episodeNumber,
              }
            : {}),
        },
      });
    },

    async deleteItem(listId: number, itemId: number, userId: number) {
      const logger = localLogger('deleteItem');
      logger.debug({ listId, itemId, userId }, 'Removing item from list');

      const result = await prisma.listItem.deleteMany({
        where: {
          id: itemId,
          listId,
          list: {
            creatorId: userId,
          },
        },
      });

      if (result.count === 0) {
        throw new HttpError('List item not found', { statusCode: 404 });
      }
    },
  };
}
