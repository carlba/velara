import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../registry.js', () => {
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
      FLEXGET_ALLOW_INSECURE_TLS: false,
    },
    __testMocks: {
      loggerMock,
    },
  };
});

vi.mock('got', () => {
  const postMock = vi.fn();
  const getMock = vi.fn();
  const putMock = vi.fn();
  const extendMock = vi.fn(() => ({ post: postMock, get: getMock, put: putMock }));

  return {
    default: {
      extend: extendMock,
    },
    __testMocks: {
      postMock,
      getMock,
      putMock,
      extendMock,
    },
  };
});

import { createFlexgetService } from './flexget-service.js';

interface TestMock {
  mockResolvedValueOnce(value: unknown): void;
  mockResolvedValue(value: unknown): void;
  mock: { calls: unknown[][] };
}

describe('Flexget service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets the series begin via Flexget series endpoint', async () => {
    const gotMock = (await vi.importMock('got')) as {
      __testMocks: {
        postMock: TestMock;
        getMock: TestMock;
        putMock: TestMock;
        extendMock: TestMock;
      };
    };
    const { postMock, extendMock } = gotMock.__testMocks;

    postMock.mockResolvedValueOnce({ statusCode: 200, body: {} });
    postMock.mockResolvedValueOnce({ statusCode: 201, body: { id: 123, name: 'Test Show' } });

    const service = createFlexgetService();
    const result = await service.setSeriesBegin(
      {
        id: 1,
        userId: 1,
        baseUrl: 'https://example.com/api',
        username: 'flexget',
        password: 'password',
      },
      'Test Show',
      2,
      5
    );

    expect(extendMock).toHaveBeenCalled();
    expect(postMock).toHaveBeenCalledWith('auth/login/', {
      json: { username: 'flexget', password: 'password' },
    });
    expect(postMock).toHaveBeenCalledWith('series/', {
      json: {
        name: 'Test Show',
        begin_episode: 'S02E05',
      },
    });
    expect(result).toEqual({ id: 123, name: 'Test Show' });
  });

  it('updates an existing series begin when Flexget returns 409 conflict', async () => {
    const gotMock = (await vi.importMock('got')) as {
      __testMocks: {
        postMock: TestMock;
        getMock: TestMock;
        putMock: TestMock;
        extendMock: TestMock;
      };
    };
    const { postMock, getMock, putMock } = gotMock.__testMocks;

    postMock.mockResolvedValueOnce({ statusCode: 200, body: {} });
    postMock.mockResolvedValueOnce({ statusCode: 409, body: { error: 'Conflict' } });
    postMock.mockResolvedValueOnce({ statusCode: 200, body: {} });
    getMock.mockResolvedValueOnce({ statusCode: 200, body: [{ id: 42, name: 'Test Show' }] });
    putMock.mockResolvedValueOnce({
      statusCode: 200,
      body: { id: 42, name: 'Test Show', begin_episode: 'S01E01' },
    });

    const service = createFlexgetService();
    const result = await service.setSeriesBegin(
      {
        id: 1,
        userId: 1,
        baseUrl: 'https://example.com/api',
        username: 'flexget',
        password: 'password',
      },
      'Test Show',
      1,
      1
    );

    expect(postMock).toHaveBeenCalledWith('auth/login/', {
      json: { username: 'flexget', password: 'password' },
    });
    expect(postMock).toHaveBeenCalledWith('series/', {
      json: { name: 'Test Show', begin_episode: 'S01E01' },
    });
    expect(getMock).toHaveBeenCalledWith('series/search/Test%20Show/', {
      searchParams: { begin: false, latest: false },
    });
    expect(putMock).toHaveBeenCalledWith('series/42/', {
      json: { begin_episode: 'S01E01' },
    });
    expect(result).toEqual({ id: 42, name: 'Test Show', begin_episode: 'S01E01' });
  });

  it('throws an HttpError when Flexget returns an unexpected response while updating an existing series', async () => {
    const gotMock = (await vi.importMock('got')) as {
      __testMocks: {
        postMock: TestMock;
        getMock: TestMock;
        putMock: TestMock;
        extendMock: TestMock;
      };
    };
    const { postMock, getMock, putMock } = gotMock.__testMocks;

    postMock.mockResolvedValueOnce({ statusCode: 200, body: {} });
    postMock.mockResolvedValueOnce({ statusCode: 409, body: { error: 'Conflict' } });
    postMock.mockResolvedValueOnce({ statusCode: 200, body: {} });
    getMock.mockResolvedValueOnce({ statusCode: 200, body: [{ id: 42, name: 'Test Show' }] });
    putMock.mockResolvedValueOnce({ statusCode: 401, body: { error: 'Unauthorized' } });

    const service = createFlexgetService();

    await expect(
      service.setSeriesBegin(
        {
          id: 1,
          userId: 1,
          baseUrl: 'https://example.com/api',
          username: 'flexget',
          password: 'password',
        },
        'Test Show',
        1,
        1
      )
    ).rejects.toThrow('Failed to update Flexget series begin');
  });
});
