import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createMovieComment,
  deleteMovieComment,
  fetchMovieComments,
} from '@/services/comments-api';

export function useMovieComments(tmdbId: number) {
  const queryClient = useQueryClient();
  const queryKey = ['movie-comments', tmdbId];

  const commentsQuery = useQuery({
    queryKey,
    queryFn: () => fetchMovieComments(tmdbId),
    staleTime: 5 * 60 * 1000,
  });

  const addComment = useMutation({
    mutationFn: (content: string) => createMovieComment(tmdbId, content),
    onSuccess: () => {
      toast.success('Comment posted');
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error('Failed to post comment'),
  });

  const removeComment = useMutation({
    mutationFn: (commentId: number) => deleteMovieComment(tmdbId, commentId),
    onSuccess: () => {
      toast.success('Comment deleted');
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error('Failed to delete comment'),
  });

  return { commentsQuery, addComment, removeComment };
}
