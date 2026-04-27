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

export interface MovieListResponse {
  results: MovieListItem[];
  page: number;
  total_pages: number;
  total_results: number;
}

export interface UserMovieData {
  watchEntry: { watchedAt: string } | null;
  rating: { score: number } | null;
  review: { content: string } | null;
}

export type SortBy = 'popularity' | 'rating';
