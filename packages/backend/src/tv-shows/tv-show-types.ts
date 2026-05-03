export interface TmdbTvListResult {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  first_air_date: string;
  overview: string;
  genre_ids: number[];
}

export interface TmdbTvDetail {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  first_air_date: string;
  overview: string;
  genres: { id: number; name: string }[];
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  networks: { id: number; name: string }[];
  episode_run_time: number[];
  external_ids: {
    imdb_id: string | null;
  };
}

export interface TmdbTvSearchResponse {
  results: TmdbTvListResult[];
  page: number;
  total_pages: number;
  total_results: number;
}

export interface TmdbTvSeasonDetail {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episodes: TmdbTvEpisode[];
}

export interface TmdbTvEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
}

export interface TvShowListItem {
  seriesTmdbId: string;
  name: string;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  voteCount: number;
  firstAirDate: string;
  overview: string;
}

export interface TvShowListResponse {
  results: TvShowListItem[];
  page: number;
  total_pages: number;
  total_results: number;
}

export interface ExternalTvRatings {
  imdbId: string | null;
  imdbRating: string | null;
  rottenTomatoes: string | null;
  metacritic: string | null;
}

export interface TvShowDetail extends TvShowListItem {
  genres: { id: number; name: string }[];
  numberOfSeasons: number;
  numberOfEpisodes: number;
  status: string;
  networks: { id: number; name: string }[];
  averageRuntime: number | null;
  externalRatings: ExternalTvRatings;
  tmdbUrl: string;
  imdbUrl: string | null;
  rtSearchUrl: string;
}

export interface TvEpisode {
  episodeNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  runtime: number | null;
  stillPath: string | null;
}

export interface TvSeason {
  seasonNumber: number;
  name: string;
  overview: string;
  posterPath: string | null;
  airDate: string | null;
  episodes: TvEpisode[];
}

export type TvSortBy = 'popularity' | 'rating' | 'watched_date' | 'my_rating';

export const TV_USER_FILTER_VALUES = ['rated', 'watched', 'reviewed', 'commented'] as const;
export type TvUserFilterValue = (typeof TV_USER_FILTER_VALUES)[number];

export interface OmdbRating {
  Source: string;
  Value: string;
}

export interface OmdbTvResponse {
  imdbRating: string;
  Ratings: OmdbRating[];
  Response: 'True' | 'False';
  Error?: string;
}
