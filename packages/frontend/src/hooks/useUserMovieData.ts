import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  updateWatch,
  removeWatch,
  updateRating,
  removeRating,
  updateReview,
  removeReview,
} from '@/services/user-data-api';

export function useUserMovieData(tmdbId: number) {
  const queryClient = useQueryClient();
  const queryKey = ['user-movie-data', tmdbId];

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const markWatched = useMutation({
    mutationFn: (watchedAt: string) => updateWatch(tmdbId, watchedAt),
    onSuccess: () => {
      toast.success('Marked as watched');
      void invalidate();
    },
    onError: () => toast.error('Failed to update watch status'),
  });

  const unmarkWatched = useMutation({
    mutationFn: () => removeWatch(tmdbId),
    onSuccess: () => {
      toast.success('Removed from watched');
      void invalidate();
    },
    onError: () => toast.error('Failed to update watch status'),
  });

  const setRating = useMutation({
    mutationFn: (score: number) => updateRating(tmdbId, score),
    onSuccess: () => {
      toast.success('Rating saved');
      void invalidate();
    },
    onError: () => toast.error('Failed to save rating'),
  });

  const clearRating = useMutation({
    mutationFn: () => removeRating(tmdbId),
    onSuccess: () => {
      toast.success('Rating removed');
      void invalidate();
    },
    onError: () => toast.error('Failed to remove rating'),
  });

  const saveReview = useMutation({
    mutationFn: (content: string) => updateReview(tmdbId, content),
    onSuccess: () => {
      toast.success('Review saved');
      void invalidate();
    },
    onError: () => toast.error('Failed to save review'),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: () => removeReview(tmdbId),
    onSuccess: () => {
      toast.success('Review deleted');
      void invalidate();
    },
    onError: () => toast.error('Failed to delete review'),
  });

  return { markWatched, unmarkWatched, setRating, clearRating, saveReview, deleteReviewMutation };
}
