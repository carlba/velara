import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./registry.js', () => {
  const loggerMock = {
    child: vi.fn().mockReturnThis(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    LOGGER: loggerMock,
    config: {
      TRAKT_CLIENT_ID: 'test-client-id',
      TRAKT_CLIENT_SECRET: 'test-client-secret',
    },
    __testMocks: {
      loggerMock,
    },
  };
});

vi.mock('got', () => {
  const postMock = vi.fn();
  const getMock = vi.fn();
  const extendMock = vi.fn(() => ({ post: postMock, get: getMock }));

  return {
    default: {
      extend: extendMock,
    },
    __testMocks: {
      postMock,
      getMock,
      extendMock,
    },
  };
});

vi.mock('./lib/prisma.js', () => {
  const upsertMock = vi.fn();
  const updateMock = vi.fn();

  return {
    prisma: {
      traktIntegration: {
        upsert: upsertMock,
        update: updateMock,
      },
    },
    __testMocks: {
      upsertMock,
      updateMock,
    },
  };
});

import { createTraktService } from './trakt-service.js';

interface TestMock {
  mockResolvedValueOnce(value: unknown): void;
  mockResolvedValue(value: unknown): void;
  mock: { calls: unknown[][] };
}

interface GotTestMocks {
  __testMocks: {
    postMock: TestMock;
    getMock: TestMock;
    extendMock: TestMock;
  };
}

interface PrismaTestMocks {
  __testMocks: {
    upsertMock: TestMock;
    updateMock: TestMock;
  };
}

describe('Trakt service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds an authorization URL with the configured client id', () => {
    const service = createTraktService();

    const url = service.getAuthorizationUrl('https://example.com/callback');

    expect(url).toBe(
      'https://trakt.tv/oauth/authorize?response_type=code&client_id=test-client-id&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback'
    );
  });

  it('exchanges an authorization code and saves the integration', async () => {
    const gotMock = (await vi.importMock('got')) as unknown as {
      __testMocks: GotTestMocks['__testMocks'];
    };
    const { postMock, getMock } = gotMock.__testMocks;
    const prismaMock = (await vi.importMock('./lib/prisma.js')) as unknown as {
      __testMocks: PrismaTestMocks['__testMocks'];
    };
    const { upsertMock } = prismaMock.__testMocks;

    postMock.mockResolvedValueOnce({
      statusCode: 200,
      body: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 7200,
        scope: 'public',
        created_at: 123456,
        token_type: 'bearer',
      },
    });
    getMock.mockResolvedValueOnce({
      statusCode: 200,
      body: {
        username: 'trakt-user',
        ids: { slug: 'trakt-user' },
      },
    });

    upsertMock.mockResolvedValue({
      id: 1,
      userId: 1,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(),
      traktUsername: 'trakt-user',
      traktSlug: 'trakt-user',
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = createTraktService();
    const integration = await service.createIntegrationFromAuthorizationCode(
      1,
      'authorization-code',
      'https://example.com/callback'
    );

    expect(postMock).toHaveBeenCalledWith('oauth/token', {
      json: {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        code: 'authorization-code',
        redirect_uri: 'https://example.com/callback',
        grant_type: 'authorization_code',
      },
    });
    expect(getMock).toHaveBeenCalledWith('users/me');
    expect(upsertMock).toHaveBeenCalled();
    expect(integration.traktUsername).toBe('trakt-user');
  });

  it('skips ratings and history sync when last activities are older than last sync', async () => {
    const gotMock = (await vi.importMock('got')) as unknown as {
      __testMocks: GotTestMocks['__testMocks'];
    };
    const { getMock } = gotMock.__testMocks as { getMock: TestMock };
    const prismaMock = (await vi.importMock('./lib/prisma.js')) as unknown as {
      __testMocks: PrismaTestMocks['__testMocks'];
    };
    const { updateMock } = prismaMock.__testMocks as { updateMock: TestMock };

    getMock.mockResolvedValueOnce({
      statusCode: 200,
      body: {
        all: '2024-01-01T00:00:00.000Z',
        movies: { watched_at: '2024-01-01T00:00:00.000Z', rated_at: '2024-01-01T00:00:00.000Z' },
        episodes: { watched_at: '2024-01-01T00:00:00.000Z' },
        shows: { rated_at: '2024-01-01T00:00:00.000Z' },
        seasons: { rated_at: '2024-01-01T00:00:00.000Z' },
      },
    });

    updateMock.mockResolvedValue({
      id: 1,
      userId: 1,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
      traktUsername: 'trakt-user',
      traktSlug: 'trakt-user',
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = createTraktService();
    await service.syncIntegration({
      id: 1,
      userId: 1,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
      traktUsername: 'trakt-user',
      traktSlug: 'trakt-user',
      lastSyncedAt: new Date('2024-01-02T00:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('sync/last_activities');
    expect(updateMock).toHaveBeenCalled();
    const firstUpdateCall = updateMock.mock.calls[0][0] as {
      where: { id: number };
      data: { lastSyncedAt: Date };
    };
    expect(firstUpdateCall.where.id).toBe(1);
    expect(firstUpdateCall.data.lastSyncedAt).toBeInstanceOf(Date);
  });

  it('fetches ratings when last activities show rating changes', async () => {
    const gotMock = (await vi.importMock('got')) as unknown as {
      __testMocks: GotTestMocks['__testMocks'];
    };
    const { getMock } = gotMock.__testMocks as { getMock: TestMock };
    const prismaMock = (await vi.importMock('./lib/prisma.js')) as unknown as {
      __testMocks: PrismaTestMocks['__testMocks'];
    };
    const { updateMock } = prismaMock.__testMocks as { updateMock: TestMock };

    getMock.mockResolvedValueOnce({
      statusCode: 200,
      body: {
        all: '2024-01-01T00:00:00.000Z',
        movies: { rated_at: '2024-01-03T00:00:00.000Z' },
      },
    });
    getMock.mockResolvedValueOnce({
      statusCode: 200,
      body: [],
    });

    updateMock.mockResolvedValue({
      id: 1,
      userId: 1,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
      traktUsername: 'trakt-user',
      traktSlug: 'trakt-user',
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = createTraktService();
    await service.syncIntegration({
      id: 1,
      userId: 1,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
      traktUsername: 'trakt-user',
      traktSlug: 'trakt-user',
      lastSyncedAt: new Date('2024-01-02T00:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(getMock).toHaveBeenCalledTimes(2);
    expect(getMock.mock.calls[0][0]).toBe('sync/last_activities');
    expect(getMock.mock.calls[1][0]).toBe('sync/ratings/all');
    expect(updateMock).toHaveBeenCalled();
    const firstUpdateCall = updateMock.mock.calls[0][0] as {
      where: { id: number };
      data: { lastSyncedAt: Date };
    };
    expect(firstUpdateCall.where.id).toBe(1);
    expect(firstUpdateCall.data.lastSyncedAt).toBeInstanceOf(Date);
  });
});
