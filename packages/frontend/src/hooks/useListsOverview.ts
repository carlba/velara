import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createList, fetchLists } from '@/services/lists-api';
import { fetchFlexgetRemoteLists, importFlexgetRemoteList } from '@/services/flexget-api';
import type { CreateListPayload } from '@/types/list';

interface UseListsOverviewOptions {
  mine: boolean;
  enabled: boolean;
}

export function useListsOverview({ mine, enabled }: UseListsOverviewOptions) {
  return useQuery({
    queryKey: ['lists-overview', mine],
    queryFn: () => fetchLists(mine),
    enabled,
    staleTime: 0,
  });
}

function useRefreshLists() {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['lists-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['my-lists'] }),
    ]);
}

export function useCreateList() {
  const refreshLists = useRefreshLists();

  return useMutation({
    mutationFn: (payload: CreateListPayload) => createList(payload),
    onSuccess: refreshLists,
  });
}

export function useFlexgetRemoteLists() {
  return useQuery({
    queryKey: ['flexget-remote-lists'],
    queryFn: fetchFlexgetRemoteLists,
    // Nothing is cached, so every opening of the import dialog loads the current remote lists.
    gcTime: 0,
    retry: false,
  });
}

export function useImportFlexgetList() {
  const refreshLists = useRefreshLists();

  return useMutation({
    mutationFn: (remoteListId: number) => importFlexgetRemoteList(remoteListId),
    onSuccess: async imported => {
      await refreshLists();
      toast.success(`Imported ${imported.title} from Flexget.`);
    },
  });
}
