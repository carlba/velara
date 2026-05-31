import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMovieDetail } from '@/services/movies-api';
import { fetchTvSeason, fetchTvShowDetail } from '@/services/tv-shows-api';
import type { ListItem } from '@/types/list';
import type { MovieDetail } from '@/types/movie';
import type { TvSeason, TvShowDetail } from '@/types/tv-show';

interface ListItemCardProps {
  item: ListItem;
}

interface ListItemMetadata {
  title: string;
  subtitle: string;
  description?: string;
  imagePath?: string | null;
  link: string;
}

function buildItemMetadata(item: ListItem): Promise<ListItemMetadata> {
  switch (item.type) {
    case 'movie':
      return fetchMovieDetail(item.movieTmdbId!).then((movie: MovieDetail) => ({
        title: movie.title,
        subtitle: new Date(movie.releaseDate).getFullYear().toString(),
        description: movie.overview,
        imagePath: movie.posterPath,
        link: `/movies/${movie.tmdbId}`,
      }));
    case 'series':
      return fetchTvShowDetail(item.seriesTmdbId!).then((show: TvShowDetail) => ({
        title: show.name,
        subtitle: show.firstAirDate
          ? new Date(show.firstAirDate).getFullYear().toString()
          : 'TV series',
        description: show.overview,
        imagePath: show.posterPath,
        link: `/tv/${show.seriesTmdbId}?list=true`,
      }));
    case 'season':
      return fetchTvSeason(item.seriesTmdbId!, item.seasonNumber!).then((season: TvSeason) => ({
        title: season.name || `Season ${season.seasonNumber}`,
        subtitle: `Season ${season.seasonNumber}`,
        description: season.overview,
        imagePath: season.posterPath,
        link: `/tv/${item.seriesTmdbId}?list=true`,
      }));
    case 'episode':
      return fetchTvSeason(item.seriesTmdbId!, item.seasonNumber!).then((season: TvSeason) => {
        const episode = season.episodes.find(ep => ep.episodeNumber === item.episodeNumber);
        return {
          title: episode?.name ?? `Episode ${item.episodeNumber}`,
          subtitle: `Season ${season.seasonNumber}${episode ? ` • Episode ${episode.episodeNumber}` : ''}`,
          description: episode?.overview ?? season.overview,
          imagePath: episode?.stillPath ?? season.posterPath,
          link: `/tv/${item.seriesTmdbId}?list=true`,
        };
      });
    default:
      return Promise.reject(new Error('Unknown list item type'));
  }
}

export default function ListItemCard({ item }: ListItemCardProps) {
  const metadataQuery = useQuery({
    queryKey: [
      'list-item-metadata',
      item.id,
      item.type,
      item.movieTmdbId,
      item.seriesTmdbId,
      item.seasonNumber,
      item.episodeNumber,
    ],
    queryFn: () => buildItemMetadata(item),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <Card>
      <CardContent className="grid gap-4 sm:grid-cols-[120px,1fr]">
        <div className="overflow-hidden rounded-xl bg-muted">
          {metadataQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : metadataQuery.isError ? (
            <div className="flex h-32 items-center justify-center text-center text-sm text-muted-foreground">
              Metadata unavailable
            </div>
          ) : metadataQuery.data?.imagePath ? (
            <img
              src={metadataQuery.data.imagePath}
              alt={metadataQuery.data.title}
              className="h-32 w-full object-cover"
            />
          ) : (
            <div className="flex h-32 items-center justify-center bg-muted text-muted-foreground">
              <span className="text-3xl">🎬</span>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between gap-3">
          {metadataQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : metadataQuery.isError || !metadataQuery.data ? (
            <div className="space-y-2">
              <p className="font-semibold">{item.type}</p>
              <p className="text-sm text-muted-foreground">
                Unable to load metadata for this item.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={metadataQuery.data.link}
                  className="text-lg font-semibold hover:text-primary">
                  {metadataQuery.data.title}
                </Link>
                <Badge variant="secondary">{item.type}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{metadataQuery.data.subtitle}</p>
              {metadataQuery.data.description ? (
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {metadataQuery.data.description}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
