import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import ListItemCard from '@/components/lists/ListItemCard';
import {
  addListItem,
  deleteList,
  deleteListItem,
  fetchListDetails,
  updateList,
} from '@/services/lists-api';
import type { AddListItemPayload, ListDetails, ListItemType } from '@/types/list';

export default function ListDetailsPage() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [list, setList] = useState<ListDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [itemType, setItemType] = useState<ListItemType>('movie');
  const [movieTmdbId, setMovieTmdbId] = useState('');
  const [seriesTmdbId, setSeriesTmdbId] = useState('');
  const [seasonNumber, setSeasonNumber] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');

  const isOwner = Boolean(user && list && user.id === list.creator.id);

  useEffect(() => {
    if (!listId) return;

    setIsLoading(true);
    setError(null);

    fetchListDetails(Number(listId))
      .then(data => {
        setList(data);
        setTitle(data.title);
        setDescription(data.description ?? '');
      })
      .catch(() => setError('Unable to load list.'))
      .finally(() => setIsLoading(false));
  }, [listId]);

  const handleSaveMetadata = async () => {
    if (!list) return;
    setIsSaving(true);
    setError(null);

    try {
      const updated = await updateList(list.id, {
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setList(current => (current ? { ...current, ...updated } : current));
    } catch {
      setError('Could not save list details.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!list || !window.confirm('Delete this list? This cannot be undone.')) {
      return;
    }

    try {
      await deleteList(list.id);
      navigate('/lists');
    } catch {
      setError('Could not delete list.');
    }
  };

  const handleAddItem = async () => {
    if (!list) return;
    setIsAddingItem(true);
    setError(null);

    try {
      const payload = {
        type: itemType,
        ...(itemType === 'movie'
          ? { movieTmdbId: Number(movieTmdbId) }
          : { seriesTmdbId: seriesTmdbId.trim() }),
        ...(itemType === 'season' || itemType === 'episode'
          ? { seasonNumber: Number(seasonNumber) }
          : {}),
        ...(itemType === 'episode' ? { episodeNumber: Number(episodeNumber) } : {}),
      } satisfies AddListItemPayload;

      await addListItem(list.id, payload);
      const updated = await fetchListDetails(list.id);
      setList(updated);
      setMovieTmdbId('');
      setSeriesTmdbId('');
      setSeasonNumber('');
      setEpisodeNumber('');
    } catch {
      setError('Could not add item to list.');
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!list) return;
    setError(null);

    try {
      await deleteListItem(list.id, itemId);
      setList(current =>
        current ? { ...current, items: current.items.filter(item => item.id !== itemId) } : current
      );
    } catch {
      setError('Could not remove item.');
    }
  };

  const itemFormFields = useMemo(() => {
    switch (itemType) {
      case 'movie':
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="movie-tmdb-id">
                TMDB Movie Id
              </label>
              <Input
                id="movie-tmdb-id"
                type="number"
                min={1}
                value={movieTmdbId}
                onChange={event => setMovieTmdbId(event.target.value)}
                placeholder="12345"
              />
            </div>
          </div>
        );
      case 'series':
        return (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="series-tmdb-id">
              Series TMDB Id
            </label>
            <Input
              id="series-tmdb-id"
              value={seriesTmdbId}
              onChange={event => setSeriesTmdbId(event.target.value)}
              placeholder="tt1234567"
            />
          </div>
        );
      case 'season':
        return (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="series-tmdb-id">
                Series TMDB Id
              </label>
              <Input
                id="series-tmdb-id"
                value={seriesTmdbId}
                onChange={event => setSeriesTmdbId(event.target.value)}
                placeholder="tt1234567"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="season-number">
                Season number
              </label>
              <Input
                id="season-number"
                type="number"
                min={0}
                value={seasonNumber}
                onChange={event => setSeasonNumber(event.target.value)}
                placeholder="1"
              />
            </div>
          </div>
        );
      case 'episode':
        return (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="series-tmdb-id">
                Series TMDB Id
              </label>
              <Input
                id="series-tmdb-id"
                value={seriesTmdbId}
                onChange={event => setSeriesTmdbId(event.target.value)}
                placeholder="tt1234567"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="season-number">
                Season number
              </label>
              <Input
                id="season-number"
                type="number"
                min={0}
                value={seasonNumber}
                onChange={event => setSeasonNumber(event.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="episode-number">
                Episode number
              </label>
              <Input
                id="episode-number"
                type="number"
                min={0}
                value={episodeNumber}
                onChange={event => setEpisodeNumber(event.target.value)}
                placeholder="1"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  }, [itemType, movieTmdbId, seriesTmdbId, seasonNumber, episodeNumber]);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading list…</div>;
  }

  if (!list) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">List not found</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link to="/lists">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to lists
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{list.title}</h1>
          <p className="text-muted-foreground">Created by {list.creator.username}</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/lists">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to lists
          </Link>
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[1.3fr,0.7fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>List details</CardTitle>
              <CardDescription>{list.description ?? 'No description provided.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="title">
                  Title
                </label>
                <Input
                  id="title"
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  disabled={!isOwner}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="description">
                  Description
                </label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  disabled={!isOwner}
                  rows={4}
                />
              </div>
              {isOwner ? (
                <div className="flex gap-2">
                  <Button onClick={handleSaveMetadata} disabled={isSaving}>
                    <Edit3 className="mr-2 h-4 w-4" /> Save details
                  </Button>
                  <Button variant="destructive" onClick={handleDelete}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete list
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                {list.items.length} item{list.items.length === 1 ? '' : 's'} in this list.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {list.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items have been added yet.</p>
              ) : (
                <div className="space-y-4">
                  {list.items.map(item => (
                    <div key={item.id} className="space-y-2">
                      <ListItemCard item={item} />
                      {isOwner ? (
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteItem(item.id)}>
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {isOwner ? (
          <Card>
            <CardHeader>
              <CardTitle>Add item</CardTitle>
              <CardDescription>
                Add a movie, series, season, or episode to the list.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={itemType}
                  onValueChange={value => setItemType(value as ListItemType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Item type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="movie">Movie</SelectItem>
                    <SelectItem value="series">Series</SelectItem>
                    <SelectItem value="season">Season</SelectItem>
                    <SelectItem value="episode">Episode</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {itemFormFields}
              <div className="flex justify-end">
                <Button onClick={handleAddItem} disabled={isAddingItem}>
                  <Plus className="mr-2 h-4 w-4" /> Add item
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
