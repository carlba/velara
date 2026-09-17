import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteHistoryRecord } from '@/hooks/useHistory';
import type { HistoryItem } from '@/types/history';

interface HistoryCardProps {
  item: HistoryItem;
}

export default function HistoryCard({ item }: HistoryCardProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const deleteRecord = useDeleteHistoryRecord();

  const isMovie = item.mediaType === 'movie';
  const linkTo = isMovie ? `/movies/${item.tmdbId}` : `/tv/${item.seriesTmdbId}`;
  const posterSrc = isMovie ? item.posterPath : (item.stillPath ?? item.posterPath);

  const handleConfirmDelete = () => {
    deleteRecord.mutate(item);
    setIsConfirmOpen(false);
  };

  return (
    <div className="group relative rounded-xl overflow-hidden bg-card border shadow-sm hover:shadow-lg transition-all duration-200">
      <Link to={linkTo} className="block">
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
          {posterSrc ? (
            <img
              src={posterSrc}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <span className="text-4xl">{isMovie ? '🎬' : '📺'}</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
            {isMovie ? (
              <>
                <p className="font-semibold text-sm leading-tight line-clamp-2">{item.title}</p>
                {item.releaseYear ? (
                  <p className="text-xs text-white/70 mt-0.5">{item.releaseYear}</p>
                ) : null}
              </>
            ) : (
              <>
                <p className="font-semibold text-sm leading-tight line-clamp-2">
                  {item.seriesName}
                </p>
                <p className="text-xs text-white/70 mt-0.5">
                  S{item.seasonNumber}E{item.episodeNumber}
                </p>
              </>
            )}
          </div>
        </div>
      </Link>

      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        onClick={() => setIsConfirmOpen(true)}
        aria-label="Remove from history">
        <Trash2 className="h-4 w-4" />
      </Button>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from history?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes this watch event. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
