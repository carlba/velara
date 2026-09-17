import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../registry.js', () => {
  const loggerMock = {
    child: vi.fn().mockReturnThis(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    config: {
      PLEX_SERVER_URL: 'http://plex.example.com:32400',
      PLEX_SERVER_TOKEN: 'test-token',
    },
    LOGGER: loggerMock,
    __testMocks: { loggerMock },
  };
});

vi.mock('../lib/prisma.js', () => {
  const upsertMock = vi.fn();
  const findUniqueMock = vi.fn();
  const deleteManyMock = vi.fn();

  return {
    prisma: {
      plexIntegration: {
        upsert: upsertMock,
        findUnique: findUniqueMock,
        deleteMany: deleteManyMock,
      },
    },
    __testMocks: { upsertMock, findUniqueMock, deleteManyMock },
  };
});

const findMovieByImdbIdMock = vi.fn();
vi.mock('../movies/movie-service.js', () => ({
  createMovieService: () => ({ findMovieByImdbId: findMovieByImdbIdMock }),
}));

vi.mock('./plex-client.js', () => {
  const libraryMetadataMock = vi.fn();

  class PlexClientMock {
    libraryMetadata = libraryMetadataMock;
  }

  return {
    PlexClient: PlexClientMock,
    __testMocks: { libraryMetadataMock },
  };
});

const createWatchEntryIfMissingForDayMock = vi.fn();
vi.mock('../watch/watch-service.js', () => ({
  createWatchService: () => ({
    createWatchEntryIfMissingForDay: createWatchEntryIfMissingForDayMock,
  }),
}));

const createEpisodeWatchEntryIfMissingForDayMock = vi.fn();
vi.mock('../tv-shows/tv-watch-service.js', () => ({
  createTvWatchService: () => ({
    createEpisodeWatchEntryIfMissingForDay: createEpisodeWatchEntryIfMissingForDayMock,
  }),
}));

import { createPlexService } from './plex-service.js';
import { WatchSource } from '../watch/watch-source.js';
import * as prismaModule from '../lib/prisma.js';
import * as plexClientModule from './plex-client.js';

interface PrismaTestMocks {
  __testMocks: {
    upsertMock: ReturnType<typeof vi.fn>;
    findUniqueMock: ReturnType<typeof vi.fn>;
    deleteManyMock: ReturnType<typeof vi.fn>;
  };
}

interface PlexClientTestMocks {
  __testMocks: {
    libraryMetadataMock: ReturnType<typeof vi.fn>;
  };
}

const { upsertMock, findUniqueMock } = (prismaModule as unknown as PrismaTestMocks).__testMocks;
const { libraryMetadataMock } = (plexClientModule as unknown as PlexClientTestMocks).__testMocks;

describe('Plex service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleWebhookPayload', () => {
    it('no-ops for non-scrobble events', async () => {
      const service = createPlexService();

      await service.handleWebhookPayload(1, { event: 'media.play' });

      expect(createWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      expect(createEpisodeWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
    });

    it('no-ops for a scrobble event with no Metadata', async () => {
      const service = createPlexService();

      await service.handleWebhookPayload(1, { event: 'media.scrobble' });

      expect(createWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
    });

    it('no-ops for unsupported media types', async () => {
      const service = createPlexService();

      await service.handleWebhookPayload(1, {
        event: 'media.scrobble',
        Metadata: { type: 'track' },
      });

      expect(createWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      expect(createEpisodeWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
    });

    describe('movie scrobbles', () => {
      it('records a watch using a direct tmdb guid', async () => {
        const service = createPlexService();

        await service.handleWebhookPayload(1, {
          event: 'media.scrobble',
          Metadata: { type: 'movie', Guid: [{ id: 'tmdb://12345' }] },
        });

        expect(findMovieByImdbIdMock).not.toHaveBeenCalled();
        expect(createWatchEntryIfMissingForDayMock).toHaveBeenCalledWith(
          12345,
          1,
          expect.any(Date),
          WatchSource.Plex
        );
      });

      it('falls back to an imdb guid lookup when no tmdb guid is present', async () => {
        findMovieByImdbIdMock.mockResolvedValueOnce({ success: true, tmdbId: 999 });
        const service = createPlexService();

        await service.handleWebhookPayload(1, {
          event: 'media.scrobble',
          Metadata: { type: 'movie', Guid: [{ id: 'imdb://tt1234567' }] },
        });

        expect(findMovieByImdbIdMock).toHaveBeenCalledWith('tt1234567');
        expect(createWatchEntryIfMissingForDayMock).toHaveBeenCalledWith(
          999,
          1,
          expect.any(Date),
          WatchSource.Plex
        );
      });

      it('no-ops when the movie cannot be resolved', async () => {
        findMovieByImdbIdMock.mockResolvedValueOnce({
          success: false,
          reason: 'not_found',
          message: 'not found',
        });
        const service = createPlexService();

        await service.handleWebhookPayload(1, {
          event: 'media.scrobble',
          Metadata: { type: 'movie', Guid: [{ id: 'imdb://tt1234567' }] },
        });

        expect(createWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      });

      it('no-ops when there is no usable guid at all', async () => {
        const service = createPlexService();

        await service.handleWebhookPayload(1, {
          event: 'media.scrobble',
          Metadata: { type: 'movie', Guid: [{ id: 'plex://movie/abc' }] },
        });

        expect(findMovieByImdbIdMock).not.toHaveBeenCalled();
        expect(createWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      });
    });

    describe('episode scrobbles', () => {
      it('records a watch by fetching the series tmdb id from the Plex server', async () => {
        libraryMetadataMock.mockResolvedValueOnce({
          MediaContainer: {
            Metadata: [{ ratingKey: '63119', Guid: [{ id: 'tmdb://555' }] }],
          },
        });
        const service = createPlexService();

        await service.handleWebhookPayload(1, {
          event: 'media.scrobble',
          Metadata: {
            type: 'episode',
            grandparentRatingKey: '63119',
            parentIndex: 2,
            index: 5,
          },
        });

        expect(createEpisodeWatchEntryIfMissingForDayMock).toHaveBeenCalledWith(
          '555',
          2,
          5,
          1,
          expect.any(Date),
          WatchSource.Plex
        );
      });

      it('no-ops when season/episode numbers are missing', async () => {
        const service = createPlexService();

        await service.handleWebhookPayload(1, {
          event: 'media.scrobble',
          Metadata: { type: 'episode', grandparentRatingKey: '63119' },
        });

        expect(createEpisodeWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      });

      it('no-ops when grandparentRatingKey is missing', async () => {
        const service = createPlexService();

        await service.handleWebhookPayload(1, {
          event: 'media.scrobble',
          Metadata: { type: 'episode', parentIndex: 1, index: 1 },
        });

        expect(createEpisodeWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      });

      it('no-ops when the Plex server has no tmdb guid for the series', async () => {
        libraryMetadataMock.mockResolvedValueOnce({
          MediaContainer: {
            Metadata: [{ ratingKey: '63119', Guid: [{ id: 'tvdb://999' }] }],
          },
        });
        const service = createPlexService();

        await service.handleWebhookPayload(1, {
          event: 'media.scrobble',
          Metadata: {
            type: 'episode',
            grandparentRatingKey: '63119',
            parentIndex: 1,
            index: 1,
          },
        });

        expect(createEpisodeWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('integration management', () => {
    it('creates or rotates a webhook token', async () => {
      upsertMock.mockResolvedValueOnce({ id: 1, userId: 1, webhookToken: 'abc' });
      const service = createPlexService();

      const result = await service.createOrRotateIntegration(1);

      expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 1 } }));
      expect(result).toEqual({ id: 1, userId: 1, webhookToken: 'abc' });
    });

    it('resolves an integration by webhook token', async () => {
      findUniqueMock.mockResolvedValueOnce({ id: 1, userId: 1, webhookToken: 'abc' });
      const service = createPlexService();

      const result = await service.getIntegrationByToken('abc');

      expect(findUniqueMock).toHaveBeenCalledWith({ where: { webhookToken: 'abc' } });
      expect(result?.userId).toBe(1);
    });
  });
});
