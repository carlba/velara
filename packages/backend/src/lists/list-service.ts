import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';
import { tmdbClient } from '../movies/tmdb-client.js';
import { createFlexgetService, type FlexgetEntryListEntry } from '../flexget/flexget-service.js';

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

  function coerceString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  function coerceNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  async function findTmdbMappingByExternalId(
    externalId: string,
    source: 'imdb_id' | 'tvdb_id'
  ): Promise<ListItemInput | null> {
    try {
      const response = await tmdbClient
        .get(`find/${externalId}`, {
          searchParams: { external_source: source },
        })
        .json<{
          movie_results: { id: number }[];
          tv_results: { id: number }[];
          tv_episode_results: Record<string, unknown>[];
          tv_season_results: Record<string, unknown>[];
        }>();

      if (response.movie_results?.length > 0) {
        return { type: 'movie', movieTmdbId: response.movie_results[0].id };
      }

      if (response.tv_episode_results?.length > 0) {
        const episode = response.tv_episode_results[0];
        const seriesTmdbId = coerceString(episode.show_id ?? episode.series_id ?? episode.showId);
        const seasonNumber = coerceNumber(episode.season_number ?? episode.seasonNumber);
        const episodeNumber = coerceNumber(episode.episode_number ?? episode.episodeNumber);
        if (seriesTmdbId && seasonNumber !== undefined && episodeNumber !== undefined) {
          return {
            type: 'episode',
            seriesTmdbId,
            seasonNumber,
            episodeNumber,
          };
        }
      }

      if (response.tv_season_results?.length > 0) {
        const season = response.tv_season_results[0];
        const seriesTmdbId = coerceString(season.show_id ?? season.series_id ?? season.showId);
        const seasonNumber = coerceNumber(season.season_number ?? season.seasonNumber);
        if (seriesTmdbId && seasonNumber !== undefined) {
          return { type: 'season', seriesTmdbId, seasonNumber };
        }
      }

      if (response.tv_results?.length > 0) {
        return { type: 'series', seriesTmdbId: String(response.tv_results[0].id) };
      }

      return null;
    } catch {
      return null;
    }
  }

  async function parseTmdbUrlToListItem(url: string): Promise<ListItemInput | null> {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
      const host = parsed.hostname.toLowerCase();

      if (host.includes('themoviedb.org')) {
        if (pathParts[0] === 'movie' && pathParts[1]) {
          const id = coerceNumber(pathParts[1]);
          if (id !== undefined) return { type: 'movie', movieTmdbId: id };
        }

        if (pathParts[0] === 'tv' && pathParts[1]) {
          const seriesTmdbId = String(pathParts[1]);
          if (pathParts[2] === 'season' && pathParts[3]) {
            const seasonNumber = coerceNumber(pathParts[3]);
            if (seasonNumber !== undefined) {
              if (pathParts[4] === 'episode' && pathParts[5]) {
                const episodeNumber = coerceNumber(pathParts[5]);
                if (episodeNumber !== undefined) {
                  return {
                    type: 'episode',
                    seriesTmdbId,
                    seasonNumber,
                    episodeNumber,
                  };
                }
              }
              return { type: 'season', seriesTmdbId, seasonNumber };
            }
          }
          return { type: 'series', seriesTmdbId };
        }
      }

      const imdbMatch = /title\/(tt[0-9]+)/.exec(parsed.pathname);
      if (imdbMatch?.[1]) {
        return await findTmdbMappingByExternalId(imdbMatch[1], 'imdb_id');
      }

      return null;
    } catch {
      return null;
    }
  }

  async function mapFlexgetEntryToListItem(entry: FlexgetEntryListEntry): Promise<ListItemInput> {
    const metadata = entry.entry ?? {};
    const originalUrl = coerceString(entry.original_url ?? metadata.original_url ?? metadata.url);
    const imdbId = coerceString(metadata.imdb_id) ?? coerceString(metadata.imdbId);
    const tvdbId = coerceNumber(metadata.tvdb_id);
    const seasonNumber = coerceNumber(metadata.season_number);
    const episodeNumber = coerceNumber(metadata.episode_number);

    if (originalUrl) {
      const parsed = await parseTmdbUrlToListItem(originalUrl);
      if (parsed) return parsed;
    }

    if (imdbId) {
      const mapped = await findTmdbMappingByExternalId(imdbId, 'imdb_id');
      if (mapped) return mapped;
    }

    if (tvdbId !== undefined) {
      const mapped = await findTmdbMappingByExternalId(String(tvdbId), 'tvdb_id');
      if (mapped) return mapped;
    }

    if (
      seasonNumber !== undefined &&
      episodeNumber !== undefined &&
      typeof metadata.series_name === 'string'
    ) {
      const seriesTmdbId = coerceString(
        metadata.series_tmdb_id ?? metadata.seriesId ?? metadata.show_id
      );
      if (seriesTmdbId) {
        return {
          type: 'episode',
          seriesTmdbId,
          seasonNumber,
          episodeNumber,
        };
      }
    }

    if (seasonNumber !== undefined && typeof metadata.series_name === 'string') {
      const seriesTmdbId = coerceString(
        metadata.series_tmdb_id ?? metadata.seriesId ?? metadata.show_id
      );
      if (seriesTmdbId) {
        return { type: 'season', seriesTmdbId, seasonNumber };
      }
    }

    throw new HttpError(
      'Unable to import Flexget list entry because it cannot be mapped to a Velara list item',
      {
        statusCode: 502,
      }
    );
  }

  async function buildListItemsFromFlexgetEntries(
    listId: number,
    entries: FlexgetEntryListEntry[]
  ) {
    const itemData = await Promise.all(
      entries.map(async entry => buildListItemData(listId, await mapFlexgetEntryToListItem(entry)))
    );

    await prisma.$transaction(itemData.map(data => prisma.listItem.create({ data })));
  }

  async function importFlexgetList(remoteListId: number, userId: number) {
    const logger = localLogger('importFlexgetList');
    logger.debug({ remoteListId, userId }, 'Importing Flexget list');

    const integration = await flexgetService.ensureIntegration(userId);
    const remoteLists = await flexgetService.getRemoteEntryLists(integration);
    const remoteList = remoteLists.find(list => list.id === remoteListId);

    if (!remoteList) {
      throw new HttpError('Flexget entry list not found', { statusCode: 404 });
    }

    const existing = await prisma.list.findFirst({
      where: { creatorId: userId, title: remoteList.name },
      select: { id: true },
    });

    if (existing) {
      throw new HttpError('A list with the same name already exists', { statusCode: 409 });
    }

    const entries = await flexgetService.getRemoteEntryListEntries(integration, remoteListId);
    const list = await prisma.list.create({
      data: {
        title: remoteList.name,
        description: remoteList.added_on
          ? `Imported from Flexget on ${remoteList.added_on}`
          : 'Imported from Flexget',
        creatorId: userId,
      },
      include: {
        creator: { select: { id: true, username: true } },
      },
    });

    await buildListItemsFromFlexgetEntries(list.id, entries);
    return list;
  }

  function buildListItemData(listId: number, item: ListItemInput, remoteEntryId?: number) {
    return {
      listId,
      type: item.type,
      ...(remoteEntryId !== undefined ? { remoteEntryId } : {}),
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
    };
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

    async importFlexgetList(remoteListId: number, userId: number) {
      return importFlexgetList(remoteListId, userId);
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
        const remoteEntry = await flexgetService.pushEntryToRemoteList(
          integration,
          remoteList.id,
          entryPayload
        );

        return prisma.listItem.create({
          data: buildListItemData(listId, item, remoteEntry.id),
        });
      }

      return prisma.listItem.create({
        data: buildListItemData(listId, item),
      });
    },

    async deleteItem(listId: number, itemId: number, userId: number) {
      const logger = localLogger('deleteItem');
      logger.debug({ listId, itemId, userId }, 'Removing item from list');

      const item = await prisma.listItem.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          listId: true,
          remoteEntryId: true,
          list: {
            select: {
              creatorId: true,
              flexgetConnection: {
                select: { entryListName: true, remoteListId: true },
              },
            },
          },
        },
      });

      if (item?.listId !== listId || item.list?.creatorId !== userId) {
        throw new HttpError('List item not found', { statusCode: 404 });
      }

      if (item.list.flexgetConnection?.remoteListId && item.remoteEntryId != null) {
        const integration = await flexgetService.ensureIntegration(userId);
        await flexgetService.deleteEntryFromRemoteList(
          integration,
          item.list.flexgetConnection.remoteListId,
          item.remoteEntryId
        );
      }

      await prisma.listItem.delete({ where: { id: itemId } });
    },
  };
}
