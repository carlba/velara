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

export interface TvShowListResponse {
  results: TvShowListItem[];
  page: number;
  total_pages: number;
  total_results: number;
}

export interface UserTvWatchEntry {
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: string;
}

export interface UserTvHistoryEntry extends UserTvWatchEntry {
  source: string;
}

export interface UserTvData {
  watchEntries: UserTvWatchEntry[];
  watchHistory: UserTvHistoryEntry[];
  showRating: { score: number } | null;
  seasonRatings: Record<number, number>;
  review: { content: string } | null;
}

export interface TvComment {
  id: number;
  seriesTmdbId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    username: string;
  };
}

export type TvSortBy = 'popularity' | 'rating' | 'watched_date' | 'my_rating';

export type TvUserFilter = 'rated' | 'watched' | 'reviewed' | 'commented';
