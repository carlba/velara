import got from 'got';
import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { HttpError } from '../lib/http-error.js';
import { LOGGER, config } from '../registry.js';
import { prisma } from '../lib/prisma.js';
import { createMovieService } from '../movies/movie-service.js';
import { createRatingService } from '../ratings/rating-service.js';
import { createTvRatingService } from '../tv-shows/tv-rating-service.js';
import { createWatchService } from '../watch/watch-service.js';
import { createTvWatchService } from '../tv-shows/tv-watch-service.js';
import type {
  TraktHistoryEntry,
  TraktLastActivities,
  TraktProfile,
  TraktRatingEntry,
} from './trakt.types.js';
import { WatchSource } from '../watch/watch-source.js';

const TRAKT_BASE_URL = 'https://api.trakt.tv';
const TRAKT_USER_AGENT = 'Velara/0.0.1';
const PAGE_LIMIT = 100;
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

export interface TraktIntegrationRecord {
  id: number;
  userId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  traktUsername?: string | null;
  traktSlug?: string | null;
  lastSyncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ServiceOptions {
  logger?: Logger | FastifyBaseLogger;
}

interface TraktTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  created_at: number;
  token_type: string;
}

export function createTraktService(options?: ServiceOptions) {
  const serviceLogger = (options?.logger ?? LOGGER).child({ module: 'trakt-service' });

  function ensureCredentials() {
    if (!config.TRAKT_CLIENT_ID || !config.TRAKT_CLIENT_SECRET) {
      throw new HttpError('Trakt client credentials are not configured', { statusCode: 500 });
    }
  }

  function createClient(accessToken?: string) {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': TRAKT_USER_AGENT,
      'trakt-api-version': '2',
      'trakt-api-key': config.TRAKT_CLIENT_ID ?? '',
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return got.extend({
      prefixUrl: TRAKT_BASE_URL,
      responseType: 'json',
      headers,
      throwHttpErrors: false,
    });
  }

  function buildTokenPayload(overrides: Record<string, unknown>) {
    return {
      client_id: config.TRAKT_CLIENT_ID,
      client_secret: config.TRAKT_CLIENT_SECRET,
      ...overrides,
    };
  }

  function handleTraktResponse<T>(response: { statusCode: number; body: unknown }, url: string) {
    const localLogger = serviceLogger.child({ context: handleTraktResponse.name });
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body as T;
    }

    localLogger.error(
      { url, statusCode: response.statusCode, body: response.body },
      'Trakt API request failed'
    );

    throw new HttpError(`Trakt API request failed for ${url}: ${response.statusCode}`, {
      statusCode: 502,
    });
  }

  function fetchTraktUserProfile(accessToken: string) {
    const client = createClient(accessToken);
    const response = client.get('users/me');
    return response.then(result => handleTraktResponse<TraktProfile>(result, 'users/me'));
  }

  function parseTraktTimestamp(value?: string) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function isNewerThan(timestamp: string | undefined, since: Date) {
    const parsed = parseTraktTimestamp(timestamp);
    return parsed !== null && parsed.getTime() > since.getTime();
  }

  async function fetchLastActivities(accessToken: string) {
    const client = createClient(accessToken);
    const response = await client.get('sync/last_activities');
    return handleTraktResponse<TraktLastActivities>(response, 'sync/last_activities');
  }

  function ratingActivitiesChanged(activities: TraktLastActivities, since: Date) {
    return (
      isNewerThan(activities.all, since) ||
      isNewerThan(activities.movies?.rated_at, since) ||
      isNewerThan(activities.shows?.rated_at, since) ||
      isNewerThan(activities.seasons?.rated_at, since) ||
      isNewerThan(activities.episodes?.rated_at, since)
    );
  }

  function historyActivitiesChanged(activities: TraktLastActivities, since: Date) {
    return (
      isNewerThan(activities.all, since) ||
      isNewerThan(activities.movies?.watched_at, since) ||
      isNewerThan(activities.episodes?.watched_at, since)
    );
  }

  async function exchangeAuthorizationCode(code: string, redirectUri: string) {
    ensureCredentials();
    const localLogger = serviceLogger.child({ context: exchangeAuthorizationCode.name });
    const client = createClient();

    localLogger.debug({ redirectUri }, 'Exchanging authorization code for Trakt tokens');

    const response = await client.post('oauth/token', {
      json: buildTokenPayload({
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    return handleTraktResponse<TraktTokenResponse>(response, 'oauth/token');
  }

  async function refreshAccessToken(integration: TraktIntegrationRecord) {
    ensureCredentials();
    const logger = serviceLogger.child({ context: refreshAccessToken.name });
    const client = createClient();

    logger.debug({ userId: integration.userId }, 'Refreshing Trakt access token');

    const response = await client.post('oauth/token', {
      json: buildTokenPayload({
        grant_type: 'refresh_token',
        refresh_token: integration.refreshToken,
      }),
    });

    return handleTraktResponse<TraktTokenResponse>(response, 'oauth/token');
  }

  function tokenNeedsRefresh(expiresAt: Date) {
    return expiresAt.getTime() - Date.now() < TOKEN_EXPIRY_BUFFER_MS;
  }

  async function processRatingEntry(
    entry: TraktRatingEntry,
    userId: number,
    importTimestamp: Date
  ) {
    const localLogger = serviceLogger.child({ context: processRatingEntry.name });
    const ratingService = createRatingService({ logger: localLogger });
    const tvRatingService = createTvRatingService({ logger: localLogger });
    const movieService = createMovieService({ logger: localLogger });

    if (entry.type === 'movie' && entry.movie) {
      const tmdbId = typeof entry.movie.ids?.tmdb === 'number' ? entry.movie.ids.tmdb : null;

      if (!tmdbId && typeof entry.movie.ids?.imdb === 'string') {
        const lookup = await movieService.findMovieByImdbId(entry.movie.ids.imdb);
        if (lookup.success) {
          await ratingService.upsertRating(
            lookup.tmdbId,
            userId,
            entry.rating,
            new Date(entry.rated_at),
            importTimestamp,
            WatchSource.Trakt
          );
          return;
        }
      }

      if (tmdbId) {
        await ratingService.upsertRating(
          tmdbId,
          userId,
          entry.rating,
          new Date(entry.rated_at),
          importTimestamp,
          WatchSource.Trakt
        );
      }

      return;
    }

    if (entry.type === 'show' && entry.show && typeof entry.show.ids?.tmdb === 'number') {
      await tvRatingService.upsertTvRating(
        String(entry.show.ids.tmdb),
        0,
        userId,
        entry.rating,
        new Date(entry.rated_at),
        importTimestamp,
        WatchSource.Trakt
      );
    }
  }

  async function processHistoryEntry(entry: TraktHistoryEntry, userId: number) {
    const localLogger = serviceLogger.child({ context: processHistoryEntry.name });
    const watchService = createWatchService({ logger: localLogger });
    const tvWatchService = createTvWatchService({ logger: localLogger });
    const watchedAt = new Date(entry.watched_at);

    if (Number.isNaN(watchedAt.getTime())) {
      localLogger.warn({ entry }, 'Skipping Trakt history entry with invalid watched_at');
      return;
    }

    if (entry.type === 'movie' && entry.movie) {
      const tmdbId = typeof entry.movie.ids?.tmdb === 'number' ? entry.movie.ids.tmdb : null;

      if (tmdbId) {
        await watchService.getOrCreateWatchEntry(tmdbId, userId, watchedAt, WatchSource.Trakt);
      } else if (typeof entry.movie.ids?.imdb === 'string') {
        const movieService = createMovieService({ logger: localLogger });
        const lookup = await movieService.findMovieByImdbId(entry.movie.ids.imdb);
        if (lookup.success) {
          await watchService.getOrCreateWatchEntry(
            lookup.tmdbId,
            userId,
            watchedAt,
            WatchSource.Trakt
          );
        }
      }

      return;
    }

    if (entry.type === 'episode' && entry.show && entry.episode) {
      const seriesTmdbId = entry.show.ids?.tmdb;
      if (typeof seriesTmdbId === 'number') {
        await tvWatchService.markEpisodeWatched(
          String(seriesTmdbId),
          entry.episode.season,
          entry.episode.number,
          userId,
          watchedAt,
          WatchSource.Trakt
        );
      }
    }
  }

  async function fetchPaginated<T>(
    client: {
      get: (
        path: string,
        options: { searchParams: Record<string, string> }
      ) => Promise<{ statusCode: number; body: unknown }>;
    },
    path: string,
    params: Record<string, string>
  ) {
    const localLogger = serviceLogger.child({ context: fetchPaginated.name });
    const results: T[] = [];
    let page = 1;

    while (true) {
      const response = await client.get(path, {
        searchParams: { ...params, page: String(page), limit: String(PAGE_LIMIT) },
      });

      localLogger.debug(
        {
          path,
          params: { ...params, page: String(page), limit: String(PAGE_LIMIT) },
          statusCode: response.statusCode,
        },
        'Fetched Trakt page'
      );

      const pageResults = handleTraktResponse<T[]>(response, path);
      if (pageResults.length === 0) {
        break;
      }

      results.push(...pageResults);
      if (pageResults.length < PAGE_LIMIT) {
        break;
      }

      page += 1;
    }

    return results;
  }

  return {
    getAuthorizationUrl(redirectUri: string) {
      ensureCredentials();
      return `https://trakt.tv/oauth/authorize?response_type=code&client_id=${encodeURIComponent(
        config.TRAKT_CLIENT_ID ?? ''
      )}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    },

    async getIntegration(userId: number) {
      const localLogger = serviceLogger.child({ context: this.getIntegration.name });
      localLogger.debug({ userId }, 'Fetching Trakt integration');
      return prisma.traktIntegration.findUnique({ where: { userId } });
    },

    async createIntegrationFromAuthorizationCode(
      userId: number,
      code: string,
      redirectUri: string
    ) {
      const loggerLocal = serviceLogger.child({
        context: this.createIntegrationFromAuthorizationCode.name,
      });
      loggerLocal.debug({ userId }, 'Creating Trakt integration');

      const token = await exchangeAuthorizationCode(code, redirectUri);
      const profile = await fetchTraktUserProfile(token.access_token);
      const expiresAt = new Date(Date.now() + token.expires_in * 1000);
      const traktSlug = profile.ids?.slug ?? null;

      const integration = await prisma.traktIntegration.upsert({
        where: { userId },
        create: {
          userId,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt,
          traktUsername: profile.username,
          traktSlug,
          lastSyncedAt: new Date(),
        },
        update: {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt,
          traktUsername: profile.username,
          traktSlug,
          lastSyncedAt: new Date(),
        },
      });

      return integration;
    },

    async deleteIntegration(userId: number) {
      const loggerLogger = serviceLogger.child({ context: this.deleteIntegration.name });
      loggerLogger.debug({ userId }, 'Deleting Trakt integration');
      await prisma.traktIntegration.deleteMany({ where: { userId } });
    },

    async syncActiveIntegrations() {
      const localLogger = serviceLogger.child({ context: this.syncActiveIntegrations.name });
      if (!config.TRAKT_CLIENT_ID || !config.TRAKT_CLIENT_SECRET) {
        localLogger.info('Skipping Trakt sync because client credentials are not configured');
        return;
      }

      const integrations = await prisma.traktIntegration.findMany();
      for (const integration of integrations) {
        try {
          await this.syncIntegration(integration);
        } catch (error) {
          localLogger.error(
            { err: error, integrationId: integration.id, userId: integration.userId },
            'Failed to sync Trakt integration'
          );
        }
      }
    },

    async syncIntegration(integration: TraktIntegrationRecord) {
      const localLogger = serviceLogger.child({ context: this.syncIntegration.name });
      localLogger.debug(
        { integrationId: integration.id, userId: integration.userId },
        'Syncing Trakt integration'
      );

      let currentIntegration = integration;
      if (tokenNeedsRefresh(integration.expiresAt)) {
        const token = await refreshAccessToken(integration);
        const expiresAt = new Date(Date.now() + token.expires_in * 1000);
        currentIntegration = await prisma.traktIntegration.update({
          where: { id: integration.id },
          data: {
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            expiresAt,
          },
        });
      }

      const syncTimestamp = new Date();
      const since = integration.lastSyncedAt ?? new Date(Date.now() - 30_000);
      const client = createClient(currentIntegration.accessToken);
      const historyParams = { start_at: since.toISOString() };

      let shouldFetchRatings = !currentIntegration.lastSyncedAt;
      let shouldFetchHistory = !currentIntegration.lastSyncedAt;

      if (currentIntegration.lastSyncedAt) {
        try {
          const lastActivities = await fetchLastActivities(currentIntegration.accessToken);
          shouldFetchRatings = ratingActivitiesChanged(lastActivities, since);
          shouldFetchHistory = historyActivitiesChanged(lastActivities, since);
          localLogger.debug(
            { shouldFetchHistory, shouldFetchRatings },
            'Checked for trakt changes since last sync'
          );
        } catch (error) {
          localLogger.warn(
            { err: error },
            'Failed to fetch Trakt last activities; falling back to full sync'
          );
          shouldFetchRatings = true;
          shouldFetchHistory = true;
        }
      }

      const [historyEntries, ratingEntries] = await Promise.all([
        shouldFetchHistory
          ? fetchPaginated<TraktHistoryEntry>(client, 'sync/history', historyParams)
          : Promise.resolve([] as TraktHistoryEntry[]),
        shouldFetchRatings
          ? fetchPaginated<TraktRatingEntry>(client, 'sync/ratings/all', {})
          : Promise.resolve([] as TraktRatingEntry[]),
      ]);

      const importTimestamp = new Date();
      for (const entry of ratingEntries) {
        await processRatingEntry(entry, currentIntegration.userId, importTimestamp);
      }

      for (const entry of historyEntries) {
        await processHistoryEntry(entry, currentIntegration.userId);
      }

      await prisma.traktIntegration.update({
        where: { id: integration.id },
        data: { lastSyncedAt: syncTimestamp },
      });
    },
  };
}
