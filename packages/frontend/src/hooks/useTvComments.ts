import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createTvComment, deleteTvComment, fetchTvComments } from '@/services/tv-comments-api';

export function useTvComments(seriesId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['tv-comments', seriesId];

  const commentsQuery = useQuery({
    queryKey,
    queryFn: () => fetchTvComments(seriesId),
    staleTime: 5 * 60 * 1000,
  });

  const addComment = useMutation({
    mutationFn: (content: string) => createTvComment(seriesId, content),
    onSuccess: () => {
      toast.success('Comment posted');
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error('Failed to post comment'),
  });

  const removeComment = useMutation({
    mutationFn: (commentId: number) => deleteTvComment(seriesId, commentId),
    onSuccess: () => {
      toast.success('Comment deleted');
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error('Failed to delete comment'),
  });

  return { commentsQuery, addComment, removeComment };
}
