import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deleteHistoryRecord, fetchHistory } from '@/services/history-api';
import type { HistoryItem, HistoryTypeFilter } from '@/types/history';

export function useHistory(type: HistoryTypeFilter) {
  return useInfiniteQuery({
    queryKey: ['history', type],
    queryFn: ({ pageParam }) => fetchHistory({ type, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => (lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined),
  });
}

export function useDeleteHistoryRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: HistoryItem) =>
      deleteHistoryRecord(item.mediaType === 'movie' ? 'movie' : 'episode', item.historyId),
    onSuccess: () => {
      toast.success('Removed from history');
      void queryClient.invalidateQueries({ queryKey: ['history'] });
    },
    onError: () => toast.error('Failed to remove history record'),
  });
}
