import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import StarRating from '@/components/movies/StarRating';
import EpisodeRow from './EpisodeRow';
import { formatDateTime } from '@/lib/utils';
import type { TvSeason, TvEpisode } from '@/types/tv-show';

interface SeasonSectionProps {
  season: TvSeason;
  watchedEpisodeKeys: Set<string>;
  latestWatchAt?: string | null;
  episodeWatchAt: Map<string, string>;
  seasonRating: number | null;
  isAuthenticated: boolean;
  isListShow: boolean;
  isBeginPending: boolean;
  onToggleEpisode: (episode: TvEpisode) => void;
  onSetBegin: (episode: TvEpisode) => void;
  onSeasonRating: (seasonNumber: number, score: number) => void;
  onClearSeasonRating: (seasonNumber: number) => void;
}

export default function SeasonSection({
  season,
  watchedEpisodeKeys,
  seasonRating,
  isAuthenticated,
  isListShow,
  isBeginPending,
  latestWatchAt,
  episodeWatchAt,
  onToggleEpisode,
  onSetBegin,
  onSeasonRating,
  onClearSeasonRating,
}: SeasonSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const watchedCount = season.episodes.filter(ep =>
    watchedEpisodeKeys.has(`s${season.seasonNumber}e${ep.episodeNumber}`)
  ).length;
  const totalCount = season.episodes.length;

  const latestWatchDate = latestWatchAt ? formatDateTime(latestWatchAt) : null;

  const handleSeasonRating = (score: number) => {
    if (seasonRating === score) {
      onClearSeasonRating(season.seasonNumber);
    } else {
      onSeasonRating(season.seasonNumber, score);
    }
  };

  return (
    <div className="border rounded-xl overflow-visible">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left">
        {season.posterPath && (
          <img
            src={season.posterPath}
            alt={season.name}
            className="h-16 w-11 object-cover rounded shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold leading-tight">{season.name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-xs">
              {watchedCount}/{totalCount} watched
            </Badge>
            {season.airDate && (
              <span className="text-xs text-muted-foreground">
                {new Date(season.airDate).getFullYear()}
              </span>
            )}
            {latestWatchDate && (
              <span className="text-xs text-muted-foreground">Last watched {latestWatchDate}</span>
            )}
          </div>
        </div>

        {isAuthenticated && (
          <div onClick={e => e.stopPropagation()}>
            <StarRating value={seasonRating} onChange={handleSeasonRating} size="sm" />
          </div>
        )}

        <span className="text-muted-foreground shrink-0">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {isOpen && (
        <div className="border-t divide-y divide-border/50">
          {season.episodes.map(episode => {
            const episodeKey = `s${season.seasonNumber}e${episode.episodeNumber}`;
            return (
              <EpisodeRow
                key={episode.episodeNumber}
                episode={episode}
                isWatched={watchedEpisodeKeys.has(episodeKey)}
                watchedAt={episodeWatchAt.get(episodeKey) ?? null}
                onToggleWatch={() => onToggleEpisode(episode)}
                onSetBegin={() => onSetBegin(episode)}
                isListShow={isListShow}
                isBeginPending={isBeginPending}
                isAuthenticated={isAuthenticated}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
