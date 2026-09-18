import { Link } from 'react-router-dom';
import { Pause, Play } from 'lucide-react';
import type { NowPlayingResponse } from '@/types/now-playing';

type PlayingState = Extract<NowPlayingResponse, { isPlaying: true }>;

interface NowPlayingCardProps {
  state: PlayingState;
}

export default function NowPlayingCard({ state }: NowPlayingCardProps) {
  const isMovie = state.mediaType === 'movie';
  const linkTo = isMovie ? `/movies/${state.tmdbId}` : `/tv/${state.seriesTmdbId}`;
  const posterSrc = isMovie ? state.posterPath : (state.stillPath ?? state.posterPath);
  const progress =
    state.viewOffsetMs && state.durationMs
      ? Math.min(100, (state.viewOffsetMs / state.durationMs) * 100)
      : 0;

  return (
    <Link
      to={linkTo}
      className="flex items-center gap-3 px-4 py-2 hover:bg-accent/50 transition-colors">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
        {posterSrc ? (
          <img src={posterSrc} alt={state.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <span className="text-lg">{isMovie ? '🎬' : '📺'}</span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">
          {isMovie ? state.title : state.seriesName}
        </p>
        {!isMovie && (
          <p className="truncate text-xs text-muted-foreground">
            S{state.seasonNumber}E{state.episodeNumber}
            {state.episodeName ? ` · ${state.episodeName}` : ''}
          </p>
        )}
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="shrink-0 text-muted-foreground">
        {state.status === 'playing' ? (
          <Play className="h-4 w-4" />
        ) : (
          <Pause className="h-4 w-4" />
        )}
      </div>
    </Link>
  );
}
