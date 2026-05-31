import got from 'got';
import { CookieJar } from 'tough-cookie';
import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { HttpError } from '../lib/http-error.js';
import { LOGGER, config } from '../registry.js';
import { prisma } from '../lib/prisma.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

export interface FlexgetIntegrationRecord {
  id: number;
  userId: number;
  baseUrl: string;
  username: string;
  password: string;
}

export interface FlexgetEntryList {
  id: number;
  name: string;
  added_on?: string;
}

export interface FlexgetEntryListEntry {
  id: number;
  name?: string;
  added_on?: string;
  title?: string;
  original_url?: string;
  entry?: Record<string, unknown>;
}

export interface FlexgetEntryPayload {
  title: string;
  original_url: string;
  [key: string]: unknown;
}

export function createFlexgetService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;
  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'flexget-service', context });

  function normalizeBaseUrl(rawBaseUrl: string) {
    const trimmed = rawBaseUrl.replace(/\/+$|^\s+|\s+$/g, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }

  function createClient(integration: FlexgetIntegrationRecord) {
    const logger = localLogger('createClient');
    const prefixUrl = normalizeBaseUrl(integration.baseUrl);
    const cookieJar = new CookieJar();

    logger.debug({ prefixUrl, username: integration.username }, 'Creating Flexget client');

    return got.extend({
      prefixUrl,
      responseType: 'json',
      headers: { Accept: 'application/json' },
      cookieJar,
      throwHttpErrors: false,
      https: {
        rejectUnauthorized: !config.FLEXGET_ALLOW_INSECURE_TLS,
      },
    });
  }

  async function authenticateClient(integration: FlexgetIntegrationRecord) {
    const logger = localLogger('authenticateClient');
    const client = createClient(integration);

    const response = await client.post('auth/login/', {
      json: { username: integration.username, password: integration.password },
    });

    if (response.statusCode !== 200) {
      logger.warn({ statusCode: response.statusCode, body: response.body }, 'Flexget login failed');
      if (response.statusCode === 401) {
        throw new HttpError('Invalid Flexget credentials', { statusCode: 401 });
      }
      throw new HttpError('Failed to authenticate with Flexget', { statusCode: 502 });
    }

    return client;
  }

  async function getRemoteEntryLists(integration: FlexgetIntegrationRecord) {
    const logger = localLogger('getRemoteEntryLists');
    const client = await authenticateClient(integration);

    const response = await client.get('entry_list/');
    if (response.statusCode !== 200) {
      logger.error(
        { statusCode: response.statusCode, body: response.body },
        'Failed to fetch remote entry lists'
      );
      throw new HttpError('Failed to fetch Flexget entry lists', { statusCode: 502 });
    }

    return response.body as FlexgetEntryList[];
  }

  async function getRemoteEntryListEntries(
    integration: FlexgetIntegrationRecord,
    remoteListId: number
  ) {
    const logger = localLogger('getRemoteEntryListEntries');
    const client = await authenticateClient(integration);

    const response = await client.get(`entry_list/${remoteListId}/entries/`);
    if (response.statusCode !== 200) {
      logger.error(
        { statusCode: response.statusCode, body: response.body, remoteListId },
        'Failed to fetch remote entry list entries'
      );
      if (response.statusCode === 404) {
        throw new HttpError('Flexget entry list not found', { statusCode: 404 });
      }
      throw new HttpError('Failed to fetch Flexget entry list entries', { statusCode: 502 });
    }

    return response.body as FlexgetEntryListEntry[];
  }

  async function getRemoteEntryListByName(
    integration: FlexgetIntegrationRecord,
    name: string
  ): Promise<FlexgetEntryList | null> {
    const lists = await getRemoteEntryLists(integration);
    return lists.find(list => list.name === name) ?? null;
  }

  async function findSeriesByName(
    integration: FlexgetIntegrationRecord,
    name: string
  ): Promise<{ id: number; name: string }[]> {
    const logger = localLogger('findSeriesByName');
    const client = await authenticateClient(integration);

    const response = await client.get(`series/search/${encodeURIComponent(name)}/`, {
      searchParams: { begin: false, latest: false },
    });

    if (response.statusCode !== 200) {
      logger.error(
        { statusCode: response.statusCode, body: response.body, name },
        'Failed to search Flexget series by name'
      );
      throw new HttpError('Failed to search Flexget series', { statusCode: 502 });
    }

    return response.body as unknown as { id: number; name: string }[];
  }

  async function createRemoteEntryList(
    integration: FlexgetIntegrationRecord,
    name: string
  ): Promise<FlexgetEntryList> {
    const logger = localLogger('createRemoteEntryList');
    const client = await authenticateClient(integration);

    const response = await client.post('entry_list/', {
      json: { name },
    });

    if (![200, 201].includes(response.statusCode)) {
      logger.error(
        { statusCode: response.statusCode, body: response.body },
        'Failed to create remote entry list'
      );
      throw new HttpError('Failed to create Flexget entry list', { statusCode: 502 });
    }

    return response.body as unknown as FlexgetEntryList;
  }

  async function getOrCreateRemoteEntryList(
    integration: FlexgetIntegrationRecord,
    name: string
  ): Promise<FlexgetEntryList> {
    const existing = await getRemoteEntryListByName(integration, name);
    if (existing) {
      return existing;
    }
    return createRemoteEntryList(integration, name);
  }

  async function pushEntryToRemoteList(
    integration: FlexgetIntegrationRecord,
    remoteListId: number,
    payload: FlexgetEntryPayload
  ): Promise<FlexgetEntryListEntry> {
    const logger = localLogger('pushEntryToRemoteList');
    const client = await authenticateClient(integration);

    const response = await client.post(`entry_list/${remoteListId}/entries/`, {
      json: payload,
    });

    if (![200, 201].includes(response.statusCode)) {
      logger.error(
        { statusCode: response.statusCode, body: response.body },
        'Failed to push entry to Flexget'
      );
      if (response.statusCode === 404) {
        throw new HttpError('Flexget list not found', { statusCode: 404 });
      }
      throw new HttpError('Failed to push item to Flexget entry list', { statusCode: 502 });
    }

    return response.body as unknown as FlexgetEntryListEntry;
  }

  async function deleteEntryFromRemoteList(
    integration: FlexgetIntegrationRecord,
    remoteListId: number,
    remoteEntryId: number
  ): Promise<void> {
    const logger = localLogger('deleteEntryFromRemoteList');
    const client = await authenticateClient(integration);

    const response = await client.delete(`entry_list/${remoteListId}/entries/${remoteEntryId}/`);
    if (response.statusCode === 404) {
      logger.warn(
        { remoteListId, remoteEntryId },
        'Flexget entry was already missing when attempting deletion'
      );
      return;
    }

    if (response.statusCode !== 200) {
      logger.error(
        { statusCode: response.statusCode, body: response.body },
        'Failed to delete entry from Flexget'
      );
      throw new HttpError('Failed to delete entry from Flexget list', { statusCode: 502 });
    }
  }

  async function setSeriesBegin(
    integration: FlexgetIntegrationRecord,
    showName: string,
    seasonNumber: number,
    episodeNumber: number
  ) {
    const logger = localLogger('setSeriesBegin');
    const client = await authenticateClient(integration);
    const beginEpisode = `S${String(seasonNumber).padStart(2, '0')}E${String(
      episodeNumber
    ).padStart(2, '0')}`;

    const response = await client.post('series/', {
      json: {
        name: showName,
        begin_episode: beginEpisode,
      },
    });

    if (response.statusCode === 409) {
      const foundSeries = await findSeriesByName(integration, showName);
      const existing = foundSeries.find(series => series.name === showName) ?? foundSeries[0];

      if (!existing) {
        throw new HttpError('Flexget series exists but could not be resolved', {
          statusCode: 502,
        });
      }

      const updateResponse = await client.put(`series/${existing.id}/`, {
        json: { begin_episode: beginEpisode },
      });

      if (![200, 201].includes(updateResponse.statusCode)) {
        logger.error(
          {
            statusCode: updateResponse.statusCode,
            body: updateResponse.body,
            showId: existing.id,
            beginEpisode,
          },
          'Failed to update existing Flexget series begin'
        );
        if (updateResponse.statusCode === 404) {
          throw new HttpError('Flexget show not found', { statusCode: 404 });
        }
        throw new HttpError('Failed to update Flexget series begin', { statusCode: 502 });
      }

      return updateResponse.body;
    }

    if (![200, 201].includes(response.statusCode)) {
      logger.error(
        { statusCode: response.statusCode, body: response.body, showName, beginEpisode },
        'Failed to set series begin in Flexget'
      );
      if (response.statusCode === 404) {
        throw new HttpError('Flexget show not found', { statusCode: 404 });
      }
      throw new HttpError('Failed to update Flexget series begin', { statusCode: 502 });
    }

    return response.body;
  }

  async function getIntegration(userId: number) {
    const logger = localLogger('getIntegration');
    logger.debug({ userId }, 'Fetching Flexget integration config');

    return prisma.flexgetIntegration.findUnique({ where: { userId } });
  }

  async function upsertIntegration(
    userId: number,
    baseUrl: string,
    username: string,
    password: string
  ) {
    const logger = localLogger('upsertIntegration');
    logger.debug({ userId, baseUrl, username }, 'Saving Flexget integration');

    const integration = await prisma.flexgetIntegration.upsert({
      where: { userId },
      create: { userId, baseUrl, username, password },
      update: { baseUrl, username, password },
    });

    await getRemoteEntryLists(integration);
    return integration;
  }

  async function deleteIntegration(userId: number) {
    const logger = localLogger('deleteIntegration');
    logger.debug({ userId }, 'Deleting Flexget integration');

    await prisma.flexgetIntegration.deleteMany({ where: { userId } });
  }

  async function ensureIntegration(userId: number) {
    const integration = await getIntegration(userId);
    if (!integration) {
      throw new HttpError('Flexget integration is not configured', { statusCode: 404 });
    }
    return integration;
  }

  return {
    getIntegration,
    upsertIntegration,
    deleteIntegration,
    ensureIntegration,
    getRemoteEntryLists,
    getOrCreateRemoteEntryList,
    getRemoteEntryListEntries,
    pushEntryToRemoteList,
    deleteEntryFromRemoteList,
    setSeriesBegin,
  };
}
