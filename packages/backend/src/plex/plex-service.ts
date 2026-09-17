import { randomBytes } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { config, LOGGER } from '../registry.js';
import { prisma } from '../lib/prisma.js';
import { createMovieService } from '../movies/movie-service.js';
import { createWatchService } from '../watch/watch-service.js';
import { createTvWatchService } from '../tv-shows/tv-watch-service.js';
import { WatchSource } from '../watch/watch-source.js';
import { findGuid } from './plex-guid.js';
import type { PlexMetadata, PlexWebhookPayload } from './plex.types.js';
import { PlexClient } from './plex-client.js';

const WEBHOOK_TOKEN_BYTES = 32;
const SCROBBLE_EVENT = 'media.scrobble';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export function createPlexService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const plexClient =
    config.PLEX_SERVER_URL && config.PLEX_SERVER_TOKEN
      ? new PlexClient(config.PLEX_SERVER_URL, config.PLEX_SERVER_TOKEN)
      : null;

  const localLogger = (context: string) => serviceLogger.child({ module: 'plex-service', context });

  async function handleScrobbleEvent(userId: number, metadata: PlexMetadata) {
    const logger = localLogger('handleScrobbleEvent');

    if (metadata.type === 'movie') {
      await handleMovieScrobble(userId, metadata, logger);
      return;
    }

    if (metadata.type === 'episode') {
      await handleEpisodeScrobble(userId, metadata, logger);
      return;
    }

    logger.debug({ userId, type: metadata.type }, 'Ignoring scrobble for unsupported media type');
  }

  async function handleMovieScrobble(
    userId: number,
    metadata: PlexMetadata,
    logger: ServiceLogger
  ) {
    const tmdbGuid = findGuid(metadata.Guid, 'tmdb');
    let tmdbId = tmdbGuid ? Number(tmdbGuid) : null;

    if (!tmdbId) {
      const imdbGuid = findGuid(metadata.Guid, 'imdb');
      if (imdbGuid) {
        const movieService = createMovieService({ logger });
        const lookup = await movieService.findMovieByImdbId(imdbGuid);
        if (lookup.success) {
          tmdbId = lookup.tmdbId;
        }
      }
    }

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
    metadata: PlexMetadata,
    logger: ServiceLogger
  ) {
    if (metadata.parentIndex === undefined || metadata.index === undefined) {
      logger.warn(
        { userId, guids: metadata.Guid },
        'Episode scrobble is missing season/episode numbers'
      );
      return;
    }

    if (!metadata.grandparentRatingKey) {
      logger.warn({ userId }, 'Episode scrobble is missing grandparentRatingKey');
      return;
    }

    if (!plexClient) {
      logger.warn(
        { userId },
        'Cannot resolve episode scrobble: Plex server is not configured (PLEX_SERVER_URL / PLEX_SERVER_TOKEN)'
      );
      return;
    }

    const libraryMetadata = await plexClient.libraryMetadata(metadata.grandparentRatingKey);

    if (!libraryMetadata.MediaContainer.Metadata?.[0].Guid) {
      logger.warn(
        { userId, metadata: libraryMetadata.MediaContainer.Metadata },
        'Incomplete metadata retrived from plex'
      );
      return;
    }

    const seriesTmdbId = findGuid(libraryMetadata.MediaContainer.Metadata[0].Guid, 'tmdb');

    if (!seriesTmdbId) {
      logger.warn(
        { userId, guids: metadata.Guid, metadata },
        'Could not resolve episode scrobble to a TMDB series id'
      );
      return;
    }

    const tvWatchService = createTvWatchService({ logger });
    await tvWatchService.createEpisodeWatchEntryIfMissingForDay(
      seriesTmdbId,
      metadata.parentIndex,
      metadata.index,
      userId,
      new Date(),
      WatchSource.Plex
    );
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

      if (payload.event !== SCROBBLE_EVENT) {
        logger.debug({ userId, event: payload.event }, 'Ignoring non-scrobble Plex webhook event');
        return;
      }

      if (!payload.Metadata) {
        logger.warn({ userId }, 'Scrobble event is missing Metadata');
        return;
      }

      await handleScrobbleEvent(userId, payload.Metadata);
    },
  };
}
