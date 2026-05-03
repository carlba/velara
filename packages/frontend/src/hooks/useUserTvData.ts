import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  updateTvRating,
  removeTvRating,
  updateTvSeasonRating,
  removeTvSeasonRating,
  updateTvReview,
  removeTvReview,
  markEpisodeWatched,
  unmarkEpisodeWatched,
} from '@/services/user-tv-data-api';

export function useUserTvData(seriesId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['user-tv-data', seriesId];

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const setShowRating = useMutation({
    mutationFn: (score: number) => updateTvRating(seriesId, score),
    onSuccess: () => {
      toast.success('Rating saved');
      void invalidate();
    },
    onError: () => toast.error('Failed to save rating'),
  });

  const clearShowRating = useMutation({
    mutationFn: () => removeTvRating(seriesId),
    onSuccess: () => {
      toast.success('Rating removed');
      void invalidate();
    },
    onError: () => toast.error('Failed to remove rating'),
  });

  const setSeasonRating = useMutation({
    mutationFn: ({ seasonNumber, score }: { seasonNumber: number; score: number }) =>
      updateTvSeasonRating(seriesId, seasonNumber, score),
    onSuccess: () => {
      toast.success('Season rating saved');
      void invalidate();
    },
    onError: () => toast.error('Failed to save season rating'),
  });

  const clearSeasonRating = useMutation({
    mutationFn: (seasonNumber: number) => removeTvSeasonRating(seriesId, seasonNumber),
    onSuccess: () => {
      toast.success('Season rating removed');
      void invalidate();
    },
    onError: () => toast.error('Failed to remove season rating'),
  });

  const saveReview = useMutation({
    mutationFn: (content: string) => updateTvReview(seriesId, content),
    onSuccess: () => {
      toast.success('Review saved');
      void invalidate();
    },
    onError: () => toast.error('Failed to save review'),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: () => removeTvReview(seriesId),
    onSuccess: () => {
      toast.success('Review deleted');
      void invalidate();
    },
    onError: () => toast.error('Failed to delete review'),
  });

  const watchEpisode = useMutation({
    mutationFn: ({
      seasonNumber,
      episodeNumber,
    }: {
      seasonNumber: number;
      episodeNumber: number;
    }) => markEpisodeWatched(seriesId, seasonNumber, episodeNumber, new Date().toISOString()),
    onSuccess: () => {
      toast.success('Episode marked as watched');
      void invalidate();
    },
    onError: () => toast.error('Failed to mark episode as watched'),
  });

  const unwatchEpisode = useMutation({
    mutationFn: ({
      seasonNumber,
      episodeNumber,
    }: {
      seasonNumber: number;
      episodeNumber: number;
    }) => unmarkEpisodeWatched(seriesId, seasonNumber, episodeNumber),
    onSuccess: () => {
      toast.success('Episode removed from watched');
      void invalidate();
    },
    onError: () => toast.error('Failed to remove episode from watched'),
  });

  return {
    setShowRating,
    clearShowRating,
    setSeasonRating,
    clearSeasonRating,
    saveReview,
    deleteReviewMutation,
    watchEpisode,
    unwatchEpisode,
  };
}
