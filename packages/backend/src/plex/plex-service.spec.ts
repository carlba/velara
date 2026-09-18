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
const getMovieDetailsMock = vi.fn();
vi.mock('../movies/movie-service.js', () => ({
  createMovieService: () => ({
    findMovieByImdbId: findMovieByImdbIdMock,
    getMovieDetails: getMovieDetailsMock,
  }),
}));

const getTvShowDetailsMock = vi.fn();
const getTvSeasonMock = vi.fn();
vi.mock('../tv-shows/tv-show-service.js', () => ({
  createTvShowService: () => ({
    getTvShowDetails: getTvShowDetailsMock,
    getTvSeason: getTvSeasonMock,
  }),
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

  describe('handleWebhookPayload — now playing events', () => {
    it('sets now-playing state for a movie play event', async () => {
      getMovieDetailsMock.mockResolvedValueOnce({
        tmdbId: 12345,
        title: 'Example Movie',
        posterPath: '/poster.jpg',
      });
      const service = createPlexService();

      await service.handleWebhookPayload(1, {
        event: 'media.play',
        Metadata: {
          type: 'movie',
          Guid: [{ id: 'tmdb://12345' }],
          viewOffset: 1000,
          duration: 5000,
        },
      });

      expect(createWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      expect(createEpisodeWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      const nowPlaying = service.getNowPlaying(1);
      expect(nowPlaying).toMatchObject({
        isPlaying: true,
        status: 'playing',
        mediaType: 'movie',
        title: 'Example Movie',
        posterPath: '/poster.jpg',
        tmdbId: 12345,
        viewOffsetMs: 1000,
        durationMs: 5000,
      });
      expect(typeof (nowPlaying as { updatedAt: string }).updatedAt).toBe('string');
    });

    it('sets now-playing state for an episode resume event', async () => {
      libraryMetadataMock.mockResolvedValueOnce({
        MediaContainer: {
          Metadata: [{ ratingKey: '63119', Guid: [{ id: 'tmdb://555' }] }],
        },
      });
      getTvShowDetailsMock.mockResolvedValueOnce({
        seriesTmdbId: '555',
        name: 'Example Series',
        posterPath: '/series-poster.jpg',
      });
      getTvSeasonMock.mockResolvedValueOnce({
        seasonNumber: 2,
        episodes: [
          { episodeNumber: 5, name: 'Example Episode', stillPath: '/still.jpg' },
        ],
      });
      const service = createPlexService();

      await service.handleWebhookPayload(1, {
        event: 'media.resume',
        Metadata: {
          type: 'episode',
          grandparentRatingKey: '63119',
          parentIndex: 2,
          index: 5,
          viewOffset: 2000,
          duration: 6000,
        },
      });

      expect(createWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      expect(createEpisodeWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      const nowPlaying = service.getNowPlaying(1);
      expect(nowPlaying).toMatchObject({
        isPlaying: true,
        status: 'playing',
        mediaType: 'episode',
        title: 'Example Series',
        posterPath: '/series-poster.jpg',
        seriesTmdbId: '555',
        seriesName: 'Example Series',
        seasonNumber: 2,
        episodeNumber: 5,
        episodeName: 'Example Episode',
        stillPath: '/still.jpg',
        viewOffsetMs: 2000,
        durationMs: 6000,
      });
      expect(typeof (nowPlaying as { updatedAt: string }).updatedAt).toBe('string');
    });

    it('pauses an existing entry without re-resolving TMDB', async () => {
      getMovieDetailsMock.mockResolvedValueOnce({
        tmdbId: 12345,
        title: 'Example Movie',
        posterPath: '/poster.jpg',
      });
      const service = createPlexService();

      await service.handleWebhookPayload(1, {
        event: 'media.play',
        Metadata: { type: 'movie', Guid: [{ id: 'tmdb://12345' }], viewOffset: 1000 },
      });

      await service.handleWebhookPayload(1, {
        event: 'media.pause',
        Metadata: { type: 'movie', Guid: [{ id: 'tmdb://12345' }], viewOffset: 1500 },
      });

      expect(getMovieDetailsMock).toHaveBeenCalledTimes(1);
      expect(createWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      expect(service.getNowPlaying(1)).toMatchObject({
        isPlaying: true,
        status: 'paused',
        viewOffsetMs: 1500,
      });
    });

    it('flips back to playing on resume', async () => {
      getMovieDetailsMock.mockResolvedValue({
        tmdbId: 12345,
        title: 'Example Movie',
        posterPath: '/poster.jpg',
      });
      const service = createPlexService();

      await service.handleWebhookPayload(1, {
        event: 'media.play',
        Metadata: { type: 'movie', Guid: [{ id: 'tmdb://12345' }] },
      });
      await service.handleWebhookPayload(1, {
        event: 'media.pause',
        Metadata: { type: 'movie', Guid: [{ id: 'tmdb://12345' }] },
      });
      await service.handleWebhookPayload(1, {
        event: 'media.resume',
        Metadata: { type: 'movie', Guid: [{ id: 'tmdb://12345' }] },
      });

      expect(createWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      expect(service.getNowPlaying(1)).toMatchObject({ isPlaying: true, status: 'playing' });
    });

    it('clears now-playing state on stop', async () => {
      getMovieDetailsMock.mockResolvedValueOnce({
        tmdbId: 12345,
        title: 'Example Movie',
        posterPath: '/poster.jpg',
      });
      const service = createPlexService();

      await service.handleWebhookPayload(1, {
        event: 'media.play',
        Metadata: { type: 'movie', Guid: [{ id: 'tmdb://12345' }] },
      });
      await service.handleWebhookPayload(1, { event: 'media.stop' });

      expect(createWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      expect(service.getNowPlaying(1)).toEqual({ isPlaying: false });
    });

    it('clears now-playing state on stop even with missing Metadata', async () => {
      getMovieDetailsMock.mockResolvedValueOnce({
        tmdbId: 12345,
        title: 'Example Movie',
        posterPath: '/poster.jpg',
      });
      const service = createPlexService();

      await service.handleWebhookPayload(1, {
        event: 'media.play',
        Metadata: { type: 'movie', Guid: [{ id: 'tmdb://12345' }] },
      });
      await service.handleWebhookPayload(1, { event: 'media.stop', Metadata: undefined });

      expect(service.getNowPlaying(1)).toEqual({ isPlaying: false });
    });

    it('leaves state as not playing when the guid cannot be resolved', async () => {
      const service = createPlexService();

      await service.handleWebhookPayload(1, {
        event: 'media.play',
        Metadata: { type: 'movie', Guid: [{ id: 'plex://movie/abc' }] },
      });

      expect(createWatchEntryIfMissingForDayMock).not.toHaveBeenCalled();
      expect(service.getNowPlaying(1)).toEqual({ isPlaying: false });
    });

    it('hides now-playing state once it goes stale', async () => {
      vi.useFakeTimers();
      try {
        getMovieDetailsMock.mockResolvedValueOnce({
          tmdbId: 12345,
          title: 'Example Movie',
          posterPath: '/poster.jpg',
        });
        const service = createPlexService();

        await service.handleWebhookPayload(1, {
          event: 'media.play',
          Metadata: { type: 'movie', Guid: [{ id: 'tmdb://12345' }] },
        });

        expect(service.getNowPlaying(1)).toMatchObject({ isPlaying: true });

        vi.advanceTimersByTime(11 * 60 * 1000);

        expect(service.getNowPlaying(1)).toEqual({ isPlaying: false });
      } finally {
        vi.useRealTimers();
      }
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
