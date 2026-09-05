import { HTTPError } from 'got';
import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { LOGGER } from '../registry.js';
import { HttpError } from '../lib/http-error.js';
import { tmdbClient } from '../movies/tmdb-client.js';
import { omdbClient } from '../movies/omdb-client.js';
import type {
  TmdbTvListResult,
  TmdbTvDetail,
  TmdbTvSearchResponse,
  TmdbTvSeasonDetail,
  OmdbTvResponse,
  TvShowListItem,
  TvShowDetail,
  TvSeason,
  TvEpisode,
  TvSortBy,
} from './tv-show-types.js';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';
const TMDB_STILL_BASE = 'https://image.tmdb.org/t/p/w300';
const MIN_VOTE_COUNT = 50;

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

function extractRating(
  ratings: { Source: string; Value: string }[],
  source: string
): string | null {
  return ratings.find(rating => rating.Source === source)?.Value ?? null;
}

function mapListItem(raw: TmdbTvListResult): TvShowListItem {
  return {
    seriesTmdbId: String(raw.id),
    name: raw.name,
    posterPath: raw.poster_path ? `${TMDB_IMAGE_BASE}${raw.poster_path}` : null,
    backdropPath: raw.backdrop_path ? `${TMDB_BACKDROP_BASE}${raw.backdrop_path}` : null,
    voteAverage: raw.vote_average,
    voteCount: raw.vote_count,
    firstAirDate: raw.first_air_date,
    overview: raw.overview,
  };
}

export function createTvShowService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) =>
    serviceLogger.child({ module: 'tv-show-service', context });

  async function fetchOmdbData(imdbId: string): Promise<OmdbTvResponse | null> {
    const logger = localLogger('fetchOmdbData');
    try {
      const response = await omdbClient
        .get('', { searchParams: { i: imdbId } })
        .json<OmdbTvResponse>();
      if (response.Response === 'False') return null;
      return response;
    } catch (error) {
      logger.error({ imdbId, err: error }, 'Failed to fetch OMDB data for TV show');
      return null;
    }
  }

  async function searchTvShows(query: string, page = 1): Promise<TmdbTvSearchResponse> {
    const logger = localLogger('searchTvShows');

    try {
      const response = await tmdbClient
        .get('search/tv', {
          searchParams: { query, page, include_adult: false },
        })
        .json<TmdbTvSearchResponse>();
      return {
        ...response,
        results: response.results.map(mapListItem) as unknown as TmdbTvListResult[],
      };
    } catch (error) {
      logger.error({ query, page, err: error }, 'TMDB TV search failed');
      if (error instanceof HTTPError) {
        throw new Error(`TMDB TV search failed: ${error.response.statusCode}`, { cause: error });
      }
      throw error;
    }
  }

  async function discoverTvShows(
    sortBy: TvSortBy = 'popularity',
    page = 1
  ): Promise<TmdbTvSearchResponse> {
    const logger = localLogger('discoverTvShows');
    const tmdbSortBy = sortBy === 'rating' ? 'vote_average.desc' : 'popularity.desc';

    try {
      const response = await tmdbClient
        .get('discover/tv', {
          searchParams: {
            sort_by: tmdbSortBy,
            page,
            [`vote_count.gte`]: MIN_VOTE_COUNT,
            include_adult: false,
          },
        })
        .json<TmdbTvSearchResponse>();
      return {
        ...response,
        results: response.results.map(mapListItem) as unknown as TmdbTvListResult[],
      };
    } catch (error) {
      logger.error({ sortBy, page, err: error }, 'TMDB TV discover failed');
      if (error instanceof HTTPError) {
        throw new Error(`TMDB TV discover failed: ${error.response.statusCode}`, { cause: error });
      }
      throw error;
    }
  }

  async function getTvShowById(seriesTmdbId: string): Promise<TvShowListItem> {
    const logger = localLogger('getTvShowById');

    try {
      const show = await tmdbClient.get(`tv/${seriesTmdbId}`).json<TmdbTvListResult>();
      return mapListItem(show);
    } catch (error) {
      logger.error({ seriesTmdbId, err: error }, 'TMDB TV request failed');
      if (error instanceof HTTPError) {
        if (error.response.statusCode === 404) {
          throw new HttpError('TV show not found', {
            statusCode: 404,
            cause: error,
          });
        }
        throw new Error(`TMDB TV request failed: ${error.response.statusCode}`, { cause: error });
      }
      throw error;
    }
  }

  async function getTvShowDetails(seriesTmdbId: string): Promise<TvShowDetail> {
    const logger = localLogger('getTvShowDetails');

    try {
      const detail = await tmdbClient
        .get(`tv/${seriesTmdbId}`, {
          searchParams: { append_to_response: 'external_ids' },
        })
        .json<TmdbTvDetail>();

      const imdbId = detail.external_ids?.imdb_id ?? null;
      const omdb = imdbId ? await fetchOmdbData(imdbId) : null;

      const averageRuntime =
        detail.episode_run_time.length > 0
          ? Math.round(
              detail.episode_run_time.reduce((sum, rt) => sum + rt, 0) /
                detail.episode_run_time.length
            )
          : null;

      return {
        seriesTmdbId: String(detail.id),
        name: detail.name,
        posterPath: detail.poster_path ? `${TMDB_IMAGE_BASE}${detail.poster_path}` : null,
        backdropPath: detail.backdrop_path ? `${TMDB_BACKDROP_BASE}${detail.backdrop_path}` : null,
        voteAverage: detail.vote_average,
        voteCount: detail.vote_count,
        firstAirDate: detail.first_air_date,
        overview: detail.overview,
        genres: detail.genres,
        numberOfSeasons: detail.number_of_seasons,
        numberOfEpisodes: detail.number_of_episodes,
        status: detail.status,
        networks: detail.networks,
        averageRuntime,
        externalRatings: {
          imdbId,
          imdbRating: omdb?.imdbRating ?? null,
          rottenTomatoes: omdb ? extractRating(omdb.Ratings, 'Rotten Tomatoes') : null,
          metacritic: omdb ? extractRating(omdb.Ratings, 'Metacritic') : null,
        },
        tmdbUrl: `https://www.themoviedb.org/tv/${seriesTmdbId}`,
        imdbUrl: imdbId ? `https://www.imdb.com/title/${imdbId}/` : null,
        rtSearchUrl: `https://www.rottentomatoes.com/search?search=${encodeURIComponent(detail.name)}`,
      };
    } catch (error) {
      logger.error({ seriesTmdbId, err: error }, 'TMDB TV details request failed');
      if (error instanceof HTTPError) {
        if (error.response.statusCode === 404) {
          throw new HttpError('TV show not found', {
            statusCode: 404,
            cause: error,
          });
        }
        throw new Error(`TMDB TV details failed: ${error.response.statusCode}`, { cause: error });
      }
      throw error;
    }
  }

  async function getTvSeason(seriesTmdbId: string, seasonNumber: number): Promise<TvSeason> {
    const logger = localLogger('getTvSeason');

    try {
      const season = await tmdbClient
        .get(`tv/${seriesTmdbId}/season/${seasonNumber}`)
        .json<TmdbTvSeasonDetail>();

      const episodes: TvEpisode[] = season.episodes.map(ep => ({
        episodeNumber: ep.episode_number,
        name: ep.name,
        overview: ep.overview,
        airDate: ep.air_date,
        runtime: ep.runtime,
        stillPath: ep.still_path ? `${TMDB_STILL_BASE}${ep.still_path}` : null,
      }));

      return {
        seasonNumber: season.season_number,
        name: season.name,
        overview: season.overview,
        posterPath: season.poster_path ? `${TMDB_IMAGE_BASE}${season.poster_path}` : null,
        airDate: season.air_date,
        episodes,
      };
    } catch (error) {
      logger.error({ seriesTmdbId, seasonNumber, err: error }, 'TMDB TV season request failed');
      if (error instanceof HTTPError) {
        if (error.response.statusCode === 404) {
          throw new HttpError('TV show not found', {
            statusCode: 404,
            cause: error,
          });
        }
        throw new Error(`TMDB TV season failed: ${error.response.statusCode}`, { cause: error });
      }
      throw error;
    }
  }

  return { searchTvShows, discoverTvShows, getTvShowById, getTvShowDetails, getTvSeason };
}
