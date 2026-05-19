import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import type { TvEpisode } from '@/types/tv-show';

interface EpisodeRowProps {
  episode: TvEpisode;
  isWatched: boolean;
  watchedAt?: string | null;
  onToggleWatch: () => void;
  isAuthenticated: boolean;
}

export default function EpisodeRow({
  episode,
  isWatched,
  watchedAt,
  onToggleWatch,
  isAuthenticated,
}: EpisodeRowProps) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const tooltipId = useId();
  const airYear = episode.airDate ? new Date(episode.airDate).getFullYear() : null;
  const formattedAirDate = episode.airDate
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(episode.airDate))
    : null;
  const formattedWatchedAt = watchedAt ? formatDateTime(watchedAt) : null;

  return (
    <div
      className="relative"
      tabIndex={0}
      onMouseEnter={() => setIsTooltipOpen(true)}
      onMouseLeave={() => setIsTooltipOpen(false)}
      onFocus={() => setIsTooltipOpen(true)}
      onBlur={() => setIsTooltipOpen(false)}
      aria-describedby={tooltipId}>
      <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors">
        <span className="text-xs text-muted-foreground w-8 shrink-0 font-mono">
          {String(episode.episodeNumber).padStart(2, '0')}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight truncate">{episode.name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            {airYear && <span className="text-xs text-muted-foreground">{airYear}</span>}
            {episode.runtime && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
                {episode.runtime} min
              </Badge>
            )}
            {formattedWatchedAt && (
              <span className="text-xs text-muted-foreground">Watched {formattedWatchedAt}</span>
            )}
          </div>
        </div>

        {isAuthenticated && (
          <Button
            variant={isWatched ? 'default' : 'ghost'}
            size="sm"
            onClick={onToggleWatch}
            className="shrink-0 h-7 w-7 p-0">
            {isWatched ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="sr-only">{isWatched ? 'Unmark as watched' : 'Mark as watched'}</span>
          </Button>
        )}
      </div>

      {isTooltipOpen && (
        <div
          id={tooltipId}
          className="absolute left-0 top-full z-20 mt-2 w-[min(28rem,calc(100vw-2rem))] max-w-xl rounded-2xl border bg-popover p-4 text-popover-foreground shadow-lg">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">{episode.name}</p>
                <p className="text-xs text-muted-foreground">Episode {episode.episodeNumber}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {formattedAirDate && <span>{formattedAirDate}</span>}
              {episode.runtime && <span>{episode.runtime} min</span>}
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">
              {episode.overview || 'No summary available.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
