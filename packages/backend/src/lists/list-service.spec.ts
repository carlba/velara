import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const loggerMock = {
  child: vi.fn(() => loggerMock),
  debug: vi.fn(),
} as unknown as Logger;

const findUniqueMock = vi.fn();
const findManyMock = vi.fn();
const createMock = vi.fn();
const updateManyMock = vi.fn();
const deleteManyMock = vi.fn();
const listItemCreateMock = vi.fn();
const listIntegrationUpsertMock = vi.fn();
const listIntegrationDeleteManyMock = vi.fn();
const ensureIntegrationMock = vi.fn().mockResolvedValue({
  id: 1,
  userId: 1,
  baseUrl: 'http://localhost',
  username: 'user',
  password: 'pass',
});
const getOrCreateRemoteEntryListMock = vi.fn().mockResolvedValue({ id: 12, name: 'Remote list' });
const pushEntryToRemoteListMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../registry.js', () => ({
  LOGGER: loggerMock,
  config: { TMDB_API_KEY: 'fake-key' },
}));
const tmdbGetMock = vi.fn().mockReturnValue({
  json: vi.fn().mockResolvedValue({
    title: 'Mock Movie',
    original_title: 'Mock Movie',
    name: 'Mock Movie',
    external_ids: { imdb_id: 'tt0000001', tvdb_id: 12345 },
  }),
});

vi.mock('../movies/tmdb-client.js', () => ({
  tmdbClient: { get: tmdbGetMock },
}));

vi.mock('../flexget/flexget-service.js', () => ({
  createFlexgetService: () => ({
    ensureIntegration: ensureIntegrationMock,
    getOrCreateRemoteEntryList: getOrCreateRemoteEntryListMock,
    pushEntryToRemoteList: pushEntryToRemoteListMock,
  }),
}));
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    list: {
      findUnique: findUniqueMock,
      findMany: findManyMock,
      create: createMock,
      updateMany: updateManyMock,
      deleteMany: deleteManyMock,
    },
    listItem: {
      create: listItemCreateMock,
      deleteMany: deleteManyMock,
    },
    listIntegration: {
      upsert: listIntegrationUpsertMock,
      deleteMany: listIntegrationDeleteManyMock,
    },
  },
}));

describe('list service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('fetches all public lists', async () => {
    const lists = [
      {
        id: 1,
        title: 'Favorites',
        description: null,
        creator: { id: 5, username: 'neil' },
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { items: 2 },
      },
    ];
    findManyMock.mockResolvedValue(lists);

    const { createListService } = await import('./list-service.js');
    const service = createListService({ logger: loggerMock });

    expect(await service.getLists(undefined, false)).toBe(lists);
    expect(findManyMock).toHaveBeenCalledWith({
      where: undefined,
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
  });

  it('creates a list with creator metadata', async () => {
    const list = {
      id: 2,
      title: 'Watch later',
      description: 'My queue',
      creator: { id: 10, username: 'alex' },
    };
    createMock.mockResolvedValue(list);

    const { createListService } = await import('./list-service.js');
    const service = createListService({ logger: loggerMock });

    expect(await service.createList('Watch later', 'My queue', 10)).toBe(list);
    expect(createMock).toHaveBeenCalledWith({
      data: { title: 'Watch later', description: 'My queue', creatorId: 10 },
      include: { creator: { select: { id: true, username: true } } },
    });
  });

  it('updates list metadata for owner', async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    findUniqueMock.mockResolvedValue({
      id: 3,
      title: 'Updated',
      description: null,
      creator: { id: 8, username: 'sam' },
    });

    const { createListService } = await import('./list-service.js');
    const service = createListService({ logger: loggerMock });

    expect(await service.updateList(3, { title: 'Updated' }, 8)).toEqual({
      id: 3,
      title: 'Updated',
      description: null,
      creator: { id: 8, username: 'sam' },
    });
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: 3, creatorId: 8 },
      data: { title: 'Updated' },
    });
  });

  it('throws when deleting a non-owned list', async () => {
    deleteManyMock.mockResolvedValue({ count: 0 });

    const { createListService } = await import('./list-service.js');
    const service = createListService({ logger: loggerMock });

    await expect(service.deleteList(7, 42)).rejects.toThrow('List not found');
    expect(deleteManyMock).toHaveBeenCalledWith({ where: { id: 7, creatorId: 42 } });
  });

  it('adds an item to an owned list', async () => {
    findUniqueMock.mockResolvedValue({ id: 4, creatorId: 11 });
    listItemCreateMock.mockResolvedValue({ id: 21, listId: 4, type: 'movie', movieTmdbId: 999 });

    const { createListService } = await import('./list-service.js');
    const service = createListService({ logger: loggerMock });

    expect(await service.addItem(4, { type: 'movie', movieTmdbId: 999 }, 11)).toEqual({
      id: 21,
      listId: 4,
      type: 'movie',
      movieTmdbId: 999,
    });
    expect(listItemCreateMock).toHaveBeenCalledWith({
      data: { listId: 4, type: 'movie', movieTmdbId: 999 },
    });
  });

  it('connects a list to a Flexget entry list', async () => {
    findUniqueMock.mockResolvedValue({ id: 5, creatorId: 99 });
    listIntegrationUpsertMock.mockResolvedValue({
      id: 7,
      listId: 5,
      entryListName: 'Remote list',
      remoteListId: 12,
    });

    const { createListService } = await import('./list-service.js');
    const service = createListService({ logger: loggerMock });

    expect(await service.connectListToFlexget(5, 'Remote list', 99)).toEqual({
      id: 7,
      listId: 5,
      entryListName: 'Remote list',
      remoteListId: 12,
    });
    expect(ensureIntegrationMock).toHaveBeenCalledWith(99);
    expect(getOrCreateRemoteEntryListMock).toHaveBeenCalledWith(expect.any(Object), 'Remote list');
    expect(listIntegrationUpsertMock).toHaveBeenCalledWith({
      where: { listId: 5 },
      create: { listId: 5, entryListName: 'Remote list', remoteListId: 12 },
      update: { entryListName: 'Remote list', remoteListId: 12 },
    });
  });

  it('adds an item and pushes it to a connected Flexget list', async () => {
    findUniqueMock.mockResolvedValue({
      id: 6,
      creatorId: 11,
      flexgetConnection: { entryListName: 'Remote list', remoteListId: 12 },
    });
    listItemCreateMock.mockResolvedValue({ id: 22, listId: 6, type: 'movie', movieTmdbId: 999 });

    const { createListService } = await import('./list-service.js');
    const service = createListService({ logger: loggerMock });

    expect(await service.addItem(6, { type: 'movie', movieTmdbId: 999 }, 11)).toEqual({
      id: 22,
      listId: 6,
      type: 'movie',
      movieTmdbId: 999,
    });
    expect(ensureIntegrationMock).toHaveBeenCalledWith(11);
    expect(getOrCreateRemoteEntryListMock).toHaveBeenCalledWith(
      expect.objectContaining({}),
      'Remote list'
    );
    expect(pushEntryToRemoteListMock).toHaveBeenCalledWith(
      expect.objectContaining({}),
      12,
      expect.objectContaining({
        title: expect.any(String),
        original_url: expect.stringContaining('themoviedb.org/movie/999'),
      })
    );
    expect(listItemCreateMock).toHaveBeenCalledWith({
      data: { listId: 6, type: 'movie', movieTmdbId: 999 },
    });
  });

  it('adds a TV series item and includes tvdb_id in the Flexget payload', async () => {
    findUniqueMock.mockResolvedValue({
      id: 7,
      creatorId: 11,
      flexgetConnection: { entryListName: 'Remote list', remoteListId: 12 },
    });
    listItemCreateMock.mockResolvedValue({
      id: 23,
      listId: 7,
      type: 'series',
      seriesTmdbId: '123',
    });

    const { createListService } = await import('./list-service.js');
    const service = createListService({ logger: loggerMock });

    expect(await service.addItem(7, { type: 'series', seriesTmdbId: '123' }, 11)).toEqual({
      id: 23,
      listId: 7,
      type: 'series',
      seriesTmdbId: '123',
    });
    expect(pushEntryToRemoteListMock).toHaveBeenCalledWith(
      expect.objectContaining({}),
      12,
      expect.objectContaining({
        title: expect.any(String),
        original_url: expect.stringContaining('themoviedb.org/tv/123'),
        tvdb_id: 12345,
      })
    );
  });

  it('removes an owned item from a list', async () => {
    deleteManyMock.mockResolvedValue({ count: 1 });

    const { createListService } = await import('./list-service.js');
    const service = createListService({ logger: loggerMock });

    await expect(service.deleteItem(5, 77, 11)).resolves.toBeUndefined();
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { id: 77, listId: 5, list: { creatorId: 11 } },
    });
  });
});
