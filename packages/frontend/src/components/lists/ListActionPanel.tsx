import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { addListItem, deleteListItem, fetchListDetails, fetchLists } from '@/services/lists-api';
import type { AddListItemPayload, ListItem } from '@/types/list';

interface ListActionPanelProps {
  itemPayload: AddListItemPayload;
  itemName: string;
}

function itemMatchesPayload(item: ListItem, payload: AddListItemPayload) {
  if (item.type !== payload.type) {
    return false;
  }

  switch (payload.type) {
    case 'movie':
      return item.movieTmdbId === payload.movieTmdbId;
    case 'series':
      return item.seriesTmdbId === payload.seriesTmdbId;
    case 'season':
      return (
        item.seriesTmdbId === payload.seriesTmdbId && item.seasonNumber === payload.seasonNumber
      );
    case 'episode':
      return (
        item.seriesTmdbId === payload.seriesTmdbId &&
        item.seasonNumber === payload.seasonNumber &&
        item.episodeNumber === payload.episodeNumber
      );
    default:
      return false;
  }
}

export default function ListActionPanel({ itemPayload, itemName }: ListActionPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedListId, setSelectedListId] = useState<number | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);

  const myListsQuery = useQuery({
    queryKey: ['my-lists'],
    queryFn: () => fetchLists(true),
    enabled: !!user,
    staleTime: 0,
  });

  useEffect(() => {
    if (!selectedListId && myListsQuery.data?.length) {
      setSelectedListId(myListsQuery.data[0].id);
    }
  }, [myListsQuery.data, selectedListId]);

  const listDetailsQuery = useQuery({
    queryKey: ['list-details', selectedListId],
    queryFn: () => (selectedListId ? fetchListDetails(selectedListId) : Promise.reject()),
    enabled: selectedListId !== undefined,
    staleTime: 0,
  });

  const selectedList = useMemo(
    () => myListsQuery.data?.find(list => list.id === selectedListId),
    [myListsQuery.data, selectedListId]
  );

  const currentItem = useMemo(() => {
    if (!listDetailsQuery.data) return null;
    return listDetailsQuery.data.items.find(item => itemMatchesPayload(item, itemPayload)) ?? null;
  }, [listDetailsQuery.data, itemPayload]);

  const addMutation = useMutation({
    mutationFn: () => {
      if (!selectedListId) return Promise.reject();
      return addListItem(selectedListId, itemPayload);
    },
    onSuccess: () => {
      if (selectedListId !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['list-details', selectedListId] });
      }
      queryClient.invalidateQueries({ queryKey: ['my-lists'] });
      setActionError(null);
    },
    onError: () => setActionError('Unable to add item to the selected list.'),
  });

  const removeMutation = useMutation({
    mutationFn: () => {
      if (!selectedListId || !currentItem) return Promise.reject();
      return deleteListItem(selectedListId, currentItem.id);
    },
    onSuccess: () => {
      if (selectedListId !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['list-details', selectedListId] });
      }
      queryClient.invalidateQueries({ queryKey: ['my-lists'] });
      setActionError(null);
    },
    onError: () => setActionError('Unable to remove item from the selected list.'),
  });

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-muted p-4 text-sm text-muted-foreground">
        Sign in to add this {itemName} to your lists.
      </div>
    );
  }

  if (myListsQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading your lists…</div>;
  }

  if (!myListsQuery.data?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-muted p-4 text-sm">
        <p className="text-muted-foreground">You don’t have any lists yet.</p>
        <Button asChild size="sm" className="mt-3">
          <Link to="/lists">Create a list</Link>
        </Button>
      </div>
    );
  }

  const busy = addMutation.isPending || removeMutation.isPending || listDetailsQuery.isFetching;
  const actionLabel = currentItem ? 'Remove from selected list' : 'Add to selected list';

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Add to list</p>
            <p className="text-sm text-muted-foreground">
              Choose one of your lists to add or remove this {itemName}.
            </p>
          </div>
          {selectedList ? <Badge variant="secondary">{selectedList.itemCount} items</Badge> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
          <Select
            value={selectedListId?.toString() ?? ''}
            onValueChange={value => setSelectedListId(Number(value))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a list" />
            </SelectTrigger>
            <SelectContent>
              {myListsQuery.data.map(list => (
                <SelectItem key={list.id} value={list.id.toString()}>
                  {list.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setActionError(null);
              if (currentItem) {
                void removeMutation.mutate();
              } else {
                void addMutation.mutate();
              }
            }}
            disabled={!selectedListId || busy}
            variant={currentItem ? 'destructive' : 'default'}>
            {currentItem ? <Trash2 className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {actionLabel}
          </Button>
        </div>

        {currentItem ? (
          <div className="text-sm text-muted-foreground">
            This {itemName} is already in {selectedList?.title}.
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            This {itemName} is not in the selected list yet.
          </div>
        )}

        {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
      </div>
    </div>
  );
}
