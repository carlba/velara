export type HistoryTypeFilter = 'movies' | 'shows' | 'both';

export type HistoryMediaType = 'movie' | 'episode';

export interface HistoryItem {
  historyId: number;
  mediaType: HistoryMediaType;
  watchedAt: string;
  tmdbId?: number;
  title: string;
  posterPath: string | null;
  releaseYear?: number | null;
  seriesTmdbId?: string;
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
  stillPath?: string | null;
}

export interface HistoryResponse {
  items: HistoryItem[];
  nextCursor: string | null;
  hasMore: boolean;
}
