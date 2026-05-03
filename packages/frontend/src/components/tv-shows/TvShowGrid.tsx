import TvShowCard from './TvShowCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { TvShowListItem } from '@/types/tv-show';

interface TvShowGridProps {
  shows: TvShowListItem[];
  isLoading?: boolean;
}

const SKELETON_COUNT = 20;

export default function TvShowGrid({ shows, isLoading = false }: TvShowGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <Skeleton key={index} className="aspect-[2/3] rounded-xl" />
        ))}
      </div>
    );
  }

  if (shows.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="text-lg font-medium">No TV shows found</p>
        <p className="text-sm mt-1">Try a different search term</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {shows.map(show => (
        <TvShowCard key={show.seriesTmdbId} show={show} />
      ))}
    </div>
  );
}
