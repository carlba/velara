import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  addListItem,
  connectListToFlexget,
  deleteList,
  deleteListItem,
  disconnectListFromFlexget,
  fetchListDetails,
  updateList,
} from '@/services/lists-api';
import type { AddListItemPayload, UpdateListPayload } from '@/types/list';

export function useListDetails(listId: number) {
  return useQuery({
    queryKey: ['list-details', listId],
    queryFn: () => fetchListDetails(listId),
    staleTime: 0,
  });
}

function useRefreshList(listId: number) {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['list-details', listId] }),
      queryClient.invalidateQueries({ queryKey: ['my-lists'] }),
    ]);
}

export function useUpdateList(listId: number) {
  const refreshList = useRefreshList(listId);

  return useMutation({
    mutationFn: (payload: UpdateListPayload) => updateList(listId, payload),
    onSuccess: refreshList,
  });
}

export function useDeleteList(listId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteList(listId),
    // Only the overview is refreshed: refetching the deleted list would return 404.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-lists'] }),
    onError: () => toast.error('Could not delete list.'),
  });
}

export function useAddListItem(listId: number) {
  const refreshList = useRefreshList(listId);

  return useMutation({
    mutationFn: (payload: AddListItemPayload) => addListItem(listId, payload),
    onSuccess: refreshList,
    onError: () => toast.error('Could not add item to list.'),
  });
}

export function useDeleteListItem(listId: number) {
  const refreshList = useRefreshList(listId);

  return useMutation({
    mutationFn: (itemId: number) => deleteListItem(listId, itemId),
    onSuccess: refreshList,
    onError: () => toast.error('Could not remove item.'),
  });
}

export function useConnectListToFlexget(listId: number) {
  const refreshList = useRefreshList(listId);

  return useMutation({
    mutationFn: (entryListName: string) => connectListToFlexget(listId, entryListName),
    onSuccess: async () => {
      await refreshList();
      toast.success('List connected to Flexget entry list.');
    },
  });
}

export function useDisconnectListFromFlexget(listId: number) {
  const refreshList = useRefreshList(listId);

  return useMutation({
    mutationFn: () => disconnectListFromFlexget(listId),
    onSuccess: async () => {
      await refreshList();
      toast.success('List disconnected from Flexget.');
    },
  });
}
