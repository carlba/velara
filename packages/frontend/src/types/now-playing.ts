export type NowPlayingResponse =
  | { isPlaying: false }
  | {
      isPlaying: true;
      status: 'playing' | 'paused';
      mediaType: 'movie' | 'episode';
      title: string;
      posterPath: string | null;
      tmdbId?: number;
      seriesTmdbId?: string;
      seriesName?: string;
      seasonNumber?: number;
      episodeNumber?: number;
      episodeName?: string;
      stillPath?: string | null;
      viewOffsetMs: number | null;
      durationMs: number | null;
      updatedAt: string;
    };
