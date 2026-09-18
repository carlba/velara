import { randomBytes } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { config, LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';
import { createMovieService } from '../movies/movie-service.js';
import { createTvShowService } from '../tv-shows/tv-show-service.js';
import { createWatchService } from '../watch/watch-service.js';
import { createTvWatchService } from '../tv-shows/tv-watch-service.js';
import { WatchSource } from '../watch/watch-source.js';
import { findGuid } from './plex-guid.js';
import { isPlexEpisodeMetadata, isPlexMovieMetadata } from './plex.types.js';
import type {
  NowPlayingResponse,
  PlexEpisodeMetadata,
  PlexMetadata,
  PlexMovieMetadata,
  PlexWebhookPayload,
} from './plex.types.js';
import { PlexClient } from './plex-client.js';

const WEBHOOK_TOKEN_BYTES = 32;
const SCROBBLE_EVENT = 'media.scrobble';
const NOW_PLAYING_EVENTS = new Set(['media.play', 'media.pause', 'media.resume', 'media.stop']);
const NOW_PLAYING_STALE_MS = 10 * 60 * 1000;

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

interface NowPlayingState {
  status: 'playing' | 'paused';
  mediaType: 'movie' | 'episode';
  sessionKey: string | null;
  title: string;
  posterPath: string | null;
  tmdbId?: number;
  seriesTmdbId?: string;
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
  stillPath?: string | null;
  viewOffsetMs: number | null;
  durationMs: number | null;
  updatedAt: Date;
}

interface EpisodeIdentity {
  seriesTmdbId: string;
  seasonNumber: number;
  episodeNumber: number;
}

export function createPlexService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const plexClient =
    config.PLEX_SERVER_URL && config.PLEX_SERVER_TOKEN
      ? new PlexClient(config.PLEX_SERVER_URL, config.PLEX_SERVER_TOKEN)
      : null;

  const nowPlayingByUser = new Map<number, NowPlayingState>();

  const localLogger = (context: string) => serviceLogger.child({ module: 'plex-service', context });

  async function resolveMovieTmdbId(
    metadata: PlexMovieMetadata,
    logger: ServiceLogger
  ): Promise<number | null> {
    const tmdbGuid = findGuid(metadata.Guid, 'tmdb');
    if (tmdbGuid) {
      return Number(tmdbGuid);
    }

    const imdbGuid = findGuid(metadata.Guid, 'imdb');
    if (imdbGuid) {
      const movieService = createMovieService({ logger });
      const lookup = await movieService.findMovieByImdbId(imdbGuid);
      if (lookup.success) {
        return lookup.tmdbId;
      }
    }

    return null;
  }

  async function resolveEpisodeIdentity(
    metadata: PlexEpisodeMetadata,
    logger: ServiceLogger
  ): Promise<EpisodeIdentity | null> {
    if (!plexClient) {
      logger.warn(
        'Cannot resolve episode: Plex server is not configured (PLEX_SERVER_URL / PLEX_SERVER_TOKEN)'
      );
      return null;
    }

    const libraryMetadata = await plexClient.libraryMetadata(metadata.grandparentRatingKey);

    if (!libraryMetadata.MediaContainer.Metadata?.[0].Guid) {
      logger.warn(
        { metadata: libraryMetadata.MediaContainer.Metadata },
        'Incomplete metadata retrived from plex'
      );
      return null;
    }

    const seriesTmdbId = findGuid(libraryMetadata.MediaContainer.Metadata[0].Guid, 'tmdb');

    if (!seriesTmdbId) {
      logger.warn(
        { guids: metadata.Guid, metadata },
        'Could not resolve episode to a TMDB series id'
      );
      return null;
    }

    return {
      seriesTmdbId,
      seasonNumber: metadata.parentIndex,
      episodeNumber: metadata.index,
    };
  }

  async function handleScrobbleEvent(userId: number, metadata: PlexMetadata) {
    const logger = localLogger('handleScrobbleEvent');

    if (isPlexMovieMetadata(metadata)) {
      await handleMovieScrobble(userId, metadata, logger);
      return;
    }

    if (isPlexEpisodeMetadata(metadata)) {
      await handleEpisodeScrobble(userId, metadata, logger);
      return;
    }

    logger.debug({ userId, type: metadata.type }, 'Ignoring scrobble for unsupported media type');
  }

  async function handleMovieScrobble(
    userId: number,
    metadata: PlexMovieMetadata,
    logger: ServiceLogger
  ) {
    const tmdbId = await resolveMovieTmdbId(metadata, logger);

    if (!tmdbId) {
      logger.warn(
        { userId, guids: metadata.Guid },
        'Could not resolve movie scrobble to a TMDB id'
      );
      return;
    }

    const watchService = createWatchService({ logger });
    await watchService.createWatchEntryIfMissingForDay(
      tmdbId,
      userId,
      new Date(),
      WatchSource.Plex
    );
  }

  async function handleEpisodeScrobble(
    userId: number,
    metadata: PlexEpisodeMetadata,
    logger: ServiceLogger
  ) {
    const identity = await resolveEpisodeIdentity(metadata, logger);

    if (!identity) {
      return;
    }

    const tvWatchService = createTvWatchService({ logger });
    await tvWatchService.createEpisodeWatchEntryIfMissingForDay(
      identity.seriesTmdbId,
      identity.seasonNumber,
      identity.episodeNumber,
      userId,
      new Date(),
      WatchSource.Plex
    );
  }

  function isStale(state: NowPlayingState): boolean {
    return Date.now() - state.updatedAt.getTime() > NOW_PLAYING_STALE_MS;
  }

  async function buildNowPlayingStateForMovie(
    metadata: PlexMovieMetadata,
    payload: PlexWebhookPayload,
    status: 'playing' | 'paused',
    logger: ServiceLogger
  ): Promise<NowPlayingState | null> {
    const tmdbId = await resolveMovieTmdbId(metadata, logger);
    if (!tmdbId) {
      logger.warn({ guids: metadata.Guid }, 'Could not resolve now-playing movie to a TMDB id');
      return null;
    }

    const movieService = createMovieService({ logger });
    const details = await movieService.getMovieDetails(tmdbId);

    return {
      status,
      mediaType: 'movie',
      sessionKey: payload.Session?.id ?? null,
      title: details.title,
      posterPath: details.posterPath,
      tmdbId,
      viewOffsetMs: metadata.viewOffset ?? null,
      durationMs: metadata.duration ?? null,
      updatedAt: new Date(),
    };
  }

  async function buildNowPlayingStateForEpisode(
    metadata: PlexEpisodeMetadata,
    payload: PlexWebhookPayload,
    status: 'playing' | 'paused',
    logger: ServiceLogger
  ): Promise<NowPlayingState | null> {
    const identity = await resolveEpisodeIdentity(metadata, logger);
    if (!identity) {
      return null;
    }

    const tvShowService = createTvShowService({ logger });
    const [seriesDetails, season] = await Promise.all([
      tvShowService.getTvShowDetails(identity.seriesTmdbId),
      tvShowService.getTvSeason(identity.seriesTmdbId, identity.seasonNumber),
    ]);

    const episode = season.episodes.find(
      (candidate) => candidate.episodeNumber === identity.episodeNumber
    );

    return {
      status,
      mediaType: 'episode',
      sessionKey: payload.Session?.id ?? null,
      title: seriesDetails.name,
      posterPath: seriesDetails.posterPath,
      seriesTmdbId: identity.seriesTmdbId,
      seriesName: seriesDetails.name,
      seasonNumber: identity.seasonNumber,
      episodeNumber: identity.episodeNumber,
      episodeName: episode?.name,
      stillPath: episode?.stillPath ?? null,
      viewOffsetMs: metadata.viewOffset ?? null,
      durationMs: metadata.duration ?? null,
      updatedAt: new Date(),
    };
  }

  async function handleNowPlayingEvent(
    userId: number,
    event: string,
    payload: PlexWebhookPayload,
    logger: ServiceLogger
  ) {
    if (event === 'media.stop') {
      nowPlayingByUser.delete(userId);
      return;
    }

    const metadata = payload.Metadata;
    if (!metadata) {
      logger.warn({ userId, event }, 'Now-playing event is missing Metadata');
      return;
    }

    if (event === 'media.pause') {
      const existing = nowPlayingByUser.get(userId);
      if (existing) {
        nowPlayingByUser.set(userId, {
          ...existing,
          status: 'paused',
          viewOffsetMs: metadata.viewOffset ?? existing.viewOffsetMs,
          updatedAt: new Date(),
        });
        return;
      }
    }

    const status = event === 'media.pause' ? 'paused' : 'playing';

    let state: NowPlayingState | null;
    if (isPlexMovieMetadata(metadata)) {
      state = await buildNowPlayingStateForMovie(metadata, payload, status, logger);
    } else if (isPlexEpisodeMetadata(metadata)) {
      state = await buildNowPlayingStateForEpisode(metadata, payload, status, logger);
    } else {
      logger.debug(
        { userId, type: metadata.type },
        'Ignoring now-playing event for unsupported media type'
      );
      return;
    }

    if (!state) {
      return;
    }

    nowPlayingByUser.set(userId, state);
  }

  return {
    async getIntegration(userId: number) {
      const logger = localLogger('getIntegration');
      logger.debug({ userId }, 'Fetching Plex integration');
      return prisma.plexIntegration.findUnique({ where: { userId } });
    },

    async createOrRotateIntegration(userId: number) {
      const logger = localLogger('createOrRotateIntegration');
      logger.debug({ userId }, 'Creating or rotating Plex webhook token');

      const webhookToken = randomBytes(WEBHOOK_TOKEN_BYTES).toString('hex');

      return prisma.plexIntegration.upsert({
        where: { userId },
        create: { userId, webhookToken },
        update: { webhookToken },
      });
    },

    async deleteIntegration(userId: number) {
      const logger = localLogger('deleteIntegration');
      logger.debug({ userId }, 'Deleting Plex integration');
      await prisma.plexIntegration.deleteMany({ where: { userId } });
    },

    async getIntegrationByToken(webhookToken: string) {
      const logger = localLogger('getIntegrationByToken');
      logger.debug('Resolving Plex integration by webhook token');
      return prisma.plexIntegration.findUnique({ where: { webhookToken } });
    },

    async handleWebhookPayload(userId: number, payload: PlexWebhookPayload) {
      const logger = localLogger('handleWebhookPayload');

      if (payload.event === SCROBBLE_EVENT) {
        if (!payload.Metadata) {
          logger.warn({ userId }, 'Scrobble event is missing Metadata');
          return;
        }

        await handleScrobbleEvent(userId, payload.Metadata);
        return;
      }

      if (NOW_PLAYING_EVENTS.has(payload.event)) {
        await handleNowPlayingEvent(userId, payload.event, payload, logger);
        return;
      }

      logger.debug({ userId, event: payload.event }, 'Ignoring unsupported Plex webhook event');
    },

    getNowPlaying(userId: number): NowPlayingResponse {
      const state = nowPlayingByUser.get(userId);
      if (!state || isStale(state)) {
        return { isPlaying: false };
      }

      return {
        isPlaying: true,
        status: state.status,
        mediaType: state.mediaType,
        title: state.title,
        posterPath: state.posterPath,
        tmdbId: state.tmdbId,
        seriesTmdbId: state.seriesTmdbId,
        seriesName: state.seriesName,
        seasonNumber: state.seasonNumber,
        episodeNumber: state.episodeNumber,
        episodeName: state.episodeName,
        stillPath: state.stillPath,
        viewOffsetMs: state.viewOffsetMs,
        durationMs: state.durationMs,
        updatedAt: state.updatedAt.toISOString(),
      };
    },
  };
}
