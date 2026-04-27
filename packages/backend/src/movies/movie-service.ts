import { HTTPError } from 'got';
import { tmdbClient } from './tmdb-client.js';
import { omdbClient } from './omdb-client.js';
import type {
  TmdbSearchResponse,
  TmdbMovieListResult,
  TmdbMovieDetail,
  OmdbMovieResponse,
  MovieListItem,
  MovieDetail,
  SortBy,
} from './movie-types.js';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';
const MIN_VOTE_COUNT = 50;

function mapListItem(item: TmdbMovieListResult): MovieListItem {
  return {
    tmdbId: item.id,
    title: item.title,
    posterPath: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null,
    backdropPath: item.backdrop_path ? `${TMDB_BACKDROP_BASE}${item.backdrop_path}` : null,
    voteAverage: item.vote_average,
    voteCount: item.vote_count,
    releaseDate: item.release_date,
    overview: item.overview,
  };
}

export async function searchMovies(query: string, page = 1): Promise<TmdbSearchResponse> {
  try {
    const response = await tmdbClient
      .get('search/movie', {
        searchParams: { query, page, include_adult: false },
      })
      .json<TmdbSearchResponse>();
    return {
      ...response,
      results: response.results.map(mapListItem) as unknown as TmdbMovieListResult[],
    };
  } catch (error) {
    if (error instanceof HTTPError) {
      throw new Error(`TMDB search failed: ${error.response.statusCode}`, { cause: error });
    }
    throw error;
  }
}

export async function discoverMovies(
  sortBy: SortBy = 'popularity',
  page = 1
): Promise<TmdbSearchResponse> {
  const tmdbSortBy = sortBy === 'rating' ? 'vote_average.desc' : 'popularity.desc';

  try {
    const response = await tmdbClient
      .get('discover/movie', {
        searchParams: {
          sort_by: tmdbSortBy,
          page,
          [`vote_count.gte`]: MIN_VOTE_COUNT,
          include_adult: false,
        },
      })
      .json<TmdbSearchResponse>();
    return {
      ...response,
      results: response.results.map(mapListItem) as unknown as TmdbMovieListResult[],
    };
  } catch (error) {
    if (error instanceof HTTPError) {
      throw new Error(`TMDB discover failed: ${error.response.statusCode}`, { cause: error });
    }
    throw error;
  }
}

export async function getMovieById(tmdbId: number): Promise<TmdbMovieListResult> {
  try {
    const movie = await tmdbClient.get(`movie/${tmdbId}`).json<TmdbMovieListResult>();
    return mapListItem(movie) as unknown as TmdbMovieListResult;
  } catch (error) {
    if (error instanceof HTTPError) {
      throw new Error(`TMDB request failed: ${error.response.statusCode}`, { cause: error });
    }
    throw error;
  }
}

async function fetchOmdbData(imdbId: string): Promise<OmdbMovieResponse | null> {
  try {
    const response = await omdbClient
      .get('/', { searchParams: { i: imdbId } })
      .json<OmdbMovieResponse>();
    if (response.Response === 'False') return null;
    return response;
  } catch {
    return null;
  }
}

function extractRating(ratings: OmdbMovieResponse['Ratings'], source: string): string | null {
  return ratings.find(ratingEntry => ratingEntry.Source === source)?.Value ?? null;
}

export async function getMovieDetails(tmdbId: number): Promise<MovieDetail> {
  try {
    const detail = await tmdbClient
      .get(`movie/${tmdbId}`, {
        searchParams: { append_to_response: 'external_ids' },
      })
      .json<TmdbMovieDetail>();

    const imdbId = detail.external_ids?.imdb_id ?? null;
    const omdb = imdbId ? await fetchOmdbData(imdbId) : null;

    return {
      tmdbId: detail.id,
      title: detail.title,
      posterPath: detail.poster_path ? `${TMDB_IMAGE_BASE}${detail.poster_path}` : null,
      backdropPath: detail.backdrop_path ? `${TMDB_BACKDROP_BASE}${detail.backdrop_path}` : null,
      voteAverage: detail.vote_average,
      voteCount: detail.vote_count,
      releaseDate: detail.release_date,
      overview: detail.overview,
      genres: detail.genres,
      runtime: detail.runtime,
      externalRatings: {
        imdbId,
        imdbRating: omdb?.imdbRating ?? null,
        rottenTomatoes: omdb ? extractRating(omdb.Ratings, 'Rotten Tomatoes') : null,
        metacritic: omdb ? extractRating(omdb.Ratings, 'Metacritic') : null,
      },
      tmdbUrl: `https://www.themoviedb.org/movie/${tmdbId}`,
      imdbUrl: imdbId ? `https://www.imdb.com/title/${imdbId}/` : null,
      rtSearchUrl: `https://www.rottentomatoes.com/search?search=${encodeURIComponent(detail.title)}`,
    };
  } catch (error) {
    if (error instanceof HTTPError) {
      throw new Error(`TMDB request failed: ${error.response.statusCode}`, { cause: error });
    }
    throw error;
  }
}
