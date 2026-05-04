import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';
import { tmdbClient } from '../movies/tmdb-client.js';
import { createFlexgetService } from '../flexget/flexget-service.js';

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

interface OwnedListWithConnection {
  id: number;
  creatorId: number;
  flexgetConnection: {
    entryListName: string;
    remoteListId: number;
  } | null;
}

export function createListService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;
  const flexgetService = createFlexgetService({ logger: serviceLogger });

  const localLogger = (context: string) => serviceLogger.child({ module: 'list-service', context });

  async function ensureOwnedList(listId: number, userId: number) {
    const logger = localLogger('ensureOwnedList');
    logger.debug({ listId, userId }, 'Checking list ownership');

    const list: OwnedListWithConnection | null = await prisma.list.findUnique({
      where: { id: listId },
      select: {
        id: true,
        creatorId: true,
        flexgetConnection: { select: { entryListName: true, remoteListId: true } },
      },
    });

    if (list?.creatorId !== userId) {
      throw new HttpError('List not found', { statusCode: 404 });
    }

    return list;
  }

  async function fetchMovieMetadata(movieTmdbId: number) {
    try {
      return await tmdbClient
        .get(`movie/${movieTmdbId}`, {
          searchParams: { append_to_response: 'external_ids' },
        })
        .json<{
          title: string;
          original_title?: string;
          external_ids?: { imdb_id?: string | null };
        }>();
    } catch {
      return {
        title: `Movie ${movieTmdbId}`,
        original_title: `Movie ${movieTmdbId}`,
        external_ids: { imdb_id: null },
      };
    }
  }

  async function fetchTvShowMetadata(seriesTmdbId: string) {
    try {
      return await tmdbClient
        .get(`tv/${seriesTmdbId}`, {
          searchParams: { append_to_response: 'external_ids' },
        })
        .json<{
          name: string;
          external_ids?: { imdb_id?: string | null; tvdb_id?: number | null };
        }>();
    } catch {
      return {
        name: `TV show ${seriesTmdbId}`,
        external_ids: { imdb_id: null, tvdb_id: null },
      };
    }
  }

  async function mapItemToFlexgetEntry(item: ListItemInput) {
    switch (item.type) {
      case 'movie': {
        const movie = await fetchMovieMetadata(item.movieTmdbId);
        return {
          title: movie.title,
          original_title: movie.original_title ?? movie.title,
          original_url: `https://www.themoviedb.org/movie/${item.movieTmdbId}`,
          imdb_id: movie.external_ids?.imdb_id ?? undefined,
        };
      }
      case 'series': {
        const show = await fetchTvShowMetadata(item.seriesTmdbId);
        return {
          title: show.name,
          original_title: show.name,
          original_url: `https://www.themoviedb.org/tv/${item.seriesTmdbId}`,
          series_name: show.name,
          imdb_id: show.external_ids?.imdb_id ?? undefined,
          tvdb_id: show.external_ids?.tvdb_id ?? undefined,
        };
      }
      case 'season': {
        const show = await fetchTvShowMetadata(item.seriesTmdbId);
        return {
          title: `${show.name} Season ${item.seasonNumber}`,
          original_title: `${show.name} Season ${item.seasonNumber}`,
          original_url: `https://www.themoviedb.org/tv/${item.seriesTmdbId}/season/${item.seasonNumber}`,
          series_name: show.name,
          season_number: item.seasonNumber,
          imdb_id: show.external_ids?.imdb_id ?? undefined,
          tvdb_id: show.external_ids?.tvdb_id ?? undefined,
        };
      }
      case 'episode': {
        const show = await fetchTvShowMetadata(item.seriesTmdbId);
        return {
          title: `${show.name} S${item.seasonNumber}E${item.episodeNumber}`,
          original_title: `${show.name} S${item.seasonNumber}E${item.episodeNumber}`,
          original_url: `https://www.themoviedb.org/tv/${item.seriesTmdbId}/season/${item.seasonNumber}/episode/${item.episodeNumber}`,
          series_name: show.name,
          season_number: item.seasonNumber,
          episode_number: item.episodeNumber,
          imdb_id: show.external_ids?.imdb_id ?? undefined,
          tvdb_id: show.external_ids?.tvdb_id ?? undefined,
        };
      }
      default:
        throw new HttpError('Unsupported list item type', { statusCode: 400 });
    }
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
          flexgetConnection: true,
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

    async getListFlexgetConnection(listId: number, userId: number) {
      const logger = localLogger('getListFlexgetConnection');
      logger.debug({ listId, userId }, 'Fetching list Flexget connection');

      const list = await ensureOwnedList(listId, userId);
      return list.flexgetConnection;
    },

    async connectListToFlexget(listId: number, entryListName: string, userId: number) {
      const logger = localLogger('connectListToFlexget');
      logger.debug({ listId, entryListName, userId }, 'Connecting list to Flexget entry list');

      await ensureOwnedList(listId, userId);
      const integration = await flexgetService.ensureIntegration(userId);
      const remoteList = await flexgetService.getOrCreateRemoteEntryList(
        integration,
        entryListName
      );

      return prisma.listIntegration.upsert({
        where: { listId },
        create: {
          listId,
          entryListName: remoteList.name,
          remoteListId: remoteList.id,
        },
        update: {
          entryListName: remoteList.name,
          remoteListId: remoteList.id,
        },
      });
    },

    async disconnectListFromFlexget(listId: number, userId: number) {
      const logger = localLogger('disconnectListFromFlexget');
      logger.debug({ listId, userId }, 'Disconnecting list from Flexget');

      await ensureOwnedList(listId, userId);
      await prisma.listIntegration.deleteMany({ where: { listId } });
    },

    async addItem(listId: number, item: ListItemInput, userId: number) {
      const logger = localLogger('addItem');
      logger.debug({ listId, item, userId }, 'Adding item to list');

      const list = await ensureOwnedList(listId, userId);
      if (list.flexgetConnection) {
        const integration = await flexgetService.ensureIntegration(userId);
        const remoteList = await flexgetService.getOrCreateRemoteEntryList(
          integration,
          list.flexgetConnection.entryListName
        );

        if (remoteList.id !== list.flexgetConnection.remoteListId) {
          await prisma.listIntegration.update({
            where: { listId },
            data: { remoteListId: remoteList.id, entryListName: remoteList.name },
          });
        }

        const entryPayload = await mapItemToFlexgetEntry(item);
        await flexgetService.pushEntryToRemoteList(integration, remoteList.id, entryPayload);
      }

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
