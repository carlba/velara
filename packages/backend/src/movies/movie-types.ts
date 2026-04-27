export interface TmdbMovieListResult {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date: string;
  overview: string;
  genre_ids: number[];
}

export interface TmdbMovieDetail {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date: string;
  overview: string;
  genres: { id: number; name: string }[];
  runtime: number | null;
  external_ids: {
    imdb_id: string | null;
  };
}

export interface TmdbSearchResponse {
  results: TmdbMovieListResult[];
  page: number;
  total_pages: number;
  total_results: number;
}

export interface OmdbRating {
  Source: string;
  Value: string;
}

export interface OmdbMovieResponse {
  imdbRating: string;
  Ratings: OmdbRating[];
  Response: 'True' | 'False';
  Error?: string;
}

export interface MovieListItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  voteCount: number;
  releaseDate: string;
  overview: string;
}

export interface ExternalRatings {
  imdbId: string | null;
  imdbRating: string | null;
  rottenTomatoes: string | null;
  metacritic: string | null;
}

export interface MovieDetail extends MovieListItem {
  genres: { id: number; name: string }[];
  runtime: number | null;
  externalRatings: ExternalRatings;
  tmdbUrl: string;
  imdbUrl: string | null;
  rtSearchUrl: string;
}

export type SortBy = 'popularity' | 'rating';
