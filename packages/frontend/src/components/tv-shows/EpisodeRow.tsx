import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { TvEpisode } from '@/types/tv-show';

interface EpisodeRowProps {
  episode: TvEpisode;
  isWatched: boolean;
  onToggleWatch: () => void;
  isAuthenticated: boolean;
}

export default function EpisodeRow({
  episode,
  isWatched,
  onToggleWatch,
  isAuthenticated,
}: EpisodeRowProps) {
  const airYear = episode.airDate ? new Date(episode.airDate).getFullYear() : null;

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
      <span className="text-xs text-muted-foreground w-8 shrink-0 font-mono">
        {String(episode.episodeNumber).padStart(2, '0')}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{episode.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {airYear && <span className="text-xs text-muted-foreground">{airYear}</span>}
          {episode.runtime && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
              {episode.runtime} min
            </Badge>
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
  );
}
