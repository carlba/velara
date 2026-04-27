import MovieCard from './MovieCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { MovieListItem } from '@/types/movie';

interface MovieGridProps {
  movies: MovieListItem[];
  isLoading?: boolean;
}

const SKELETON_COUNT = 20;

export default function MovieGrid({ movies, isLoading = false }: MovieGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <Skeleton key={index} className="aspect-[2/3] rounded-xl" />
        ))}
      </div>
    );
  }

  if (movies.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="text-lg font-medium">No movies found</p>
        <p className="text-sm mt-1">Try a different search term</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {movies.map(movie => (
        <MovieCard key={movie.tmdbId} movie={movie} />
      ))}
    </div>
  );
}
