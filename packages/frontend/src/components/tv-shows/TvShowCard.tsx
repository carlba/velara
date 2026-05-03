import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TvShowListItem } from '@/types/tv-show';

interface TvShowCardProps {
  show: TvShowListItem;
}

export default function TvShowCard({ show }: TvShowCardProps) {
  const rating = show.voteAverage.toFixed(1);
  const year = show.firstAirDate ? new Date(show.firstAirDate).getFullYear() : null;

  return (
    <Link
      to={`/tv/${show.seriesTmdbId}`}
      className="group block rounded-xl overflow-hidden bg-card border shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        {show.posterPath ? (
          <img
            src={show.posterPath}
            alt={show.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <span className="text-4xl">📺</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
          <p className="font-semibold text-sm leading-tight line-clamp-2">{show.name}</p>
          {year && <p className="text-xs text-white/70 mt-0.5">{year}</p>}
        </div>

        <div className="absolute top-2 right-2">
          <Badge
            variant="secondary"
            className="flex items-center gap-1 bg-black/70 text-yellow-400 border-0 backdrop-blur-sm">
            <Star className="h-3 w-3 fill-yellow-400" />
            {rating}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
