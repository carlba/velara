import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { createList, fetchLists } from '@/services/lists-api';
import { fetchFlexgetRemoteLists, importFlexgetRemoteList } from '@/services/flexget-api';
import type { ListSummary } from '@/types/list';
import type { FlexgetConnection } from '@/services/flexget-api';

export default function ListsPage() {
  const { user, isLoading } = useAuth();
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [showMine, setShowMine] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [remoteLists, setRemoteLists] = useState<FlexgetConnection[]>([]);
  const [selectedRemoteListId, setSelectedRemoteListId] = useState<number | null>(null);
  const [isLoadingRemoteLists, setIsLoadingRemoteLists] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      setShowMine(false);
    }
  }, [isLoading, user]);

  useEffect(() => {
    async function loadLists() {
      setIsLoadingLists(true);
      setError(null);

      try {
        const data = await fetchLists(Boolean(user && showMine));
        setLists(data);
      } catch {
        setError('Unable to load lists.');
      } finally {
        setIsLoadingLists(false);
      }
    }

    loadLists();
  }, [showMine, user]);

  useEffect(() => {
    if (!isImportDialogOpen || !user) {
      return;
    }

    async function loadRemoteLists() {
      setIsLoadingRemoteLists(true);
      setImportError(null);
      setRemoteLists([]);
      setSelectedRemoteListId(null);

      try {
        const data = await fetchFlexgetRemoteLists();
        setRemoteLists(data);
      } catch {
        setImportError('Unable to load Flexget entry lists. Check your integration settings.');
      } finally {
        setIsLoadingRemoteLists(false);
      }
    }

    loadRemoteLists();
  }, [isImportDialogOpen, user]);

  const handleCreateList = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const created = await createList({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setLists(current => [
        {
          ...created,
          itemCount: 0,
          description: created.description ?? null,
        },
        ...current,
      ]);
      setTitle('');
      setDescription('');
    } catch {
      setError('Could not create list.');
    } finally {
      setIsSaving(false);
    }
  };

  const openImportDialog = () => {
    setImportError(null);
    setSelectedRemoteListId(null);
    setIsImportDialogOpen(true);
  };

  const closeImportDialog = () => {
    setIsImportDialogOpen(false);
  };

  const handleImportSelectedList = async () => {
    if (!selectedRemoteListId) {
      setImportError('Please select a Flexget list to import.');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const imported = await importFlexgetRemoteList(selectedRemoteListId);
      setLists(current => [
        {
          ...imported,
          itemCount: 0,
          description: imported.description ?? null,
        },
        ...current,
      ]);
      setIsImportDialogOpen(false);
      toast.success(`Imported ${imported.title} from Flexget.`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import list.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Lists</h1>
        <p className="text-muted-foreground">
          Browse public collections or keep your own lists handy.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant={showMine ? 'default' : 'outline'}
          onClick={() => setShowMine(true)}
          disabled={!user || isLoadingLists}>
          My lists
        </Button>
        <Button
          variant={!showMine ? 'default' : 'outline'}
          onClick={() => setShowMine(false)}
          disabled={isLoadingLists}>
          All lists
        </Button>
        {user ? (
          <Button variant="secondary" onClick={openImportDialog} disabled={isLoadingLists}>
            Import from Flexget
          </Button>
        ) : null}
      </div>

      {user ? (
        <Card>
          <CardHeader>
            <CardTitle>Create new list</CardTitle>
            <CardDescription>Give your collection a name and optional description.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="list-title">
                  Title
                </label>
                <Input
                  id="list-title"
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  placeholder="My watchlist"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="list-description">
                  Description
                </label>
                <Textarea
                  id="list-description"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  placeholder="A place for movies and shows I want to revisit."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button onClick={handleCreateList} disabled={isSaving} className="ml-auto">
                <Plus className="mr-2 h-4 w-4" />
                Create list
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sign in to create lists</CardTitle>
            <CardDescription>
              Public lists are visible to everyone, but only signed in users can manage them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {isImportDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-border bg-background p-6 shadow-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Import from Flexget</h2>
                <p className="text-sm text-muted-foreground">
                  Select a remote Flexget entry list to import into Velara.
                </p>
              </div>
              <Button variant="ghost" onClick={closeImportDialog}>
                Close
              </Button>
            </div>

            <div className="mt-6 space-y-4">
              {isLoadingRemoteLists ? (
                <div className="space-y-3">
                  <div className="h-4 w-52 rounded-lg bg-muted animate-pulse" />
                  <div className="h-4 w-32 rounded-lg bg-muted animate-pulse" />
                </div>
              ) : remoteLists.length === 0 ? (
                <div className="rounded-xl border border-muted p-4 text-sm text-muted-foreground">
                  No Flexget entry lists were found. Make sure your Flexget integration is
                  configured.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto rounded-xl border border-muted p-2">
                  {remoteLists.map(remoteList => (
                    <button
                      key={remoteList.remoteListId}
                      type="button"
                      className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                        selectedRemoteListId === remoteList.remoteListId
                          ? 'border-primary bg-primary/10'
                          : 'border-transparent hover:border-border'
                      }`}
                      onClick={() => setSelectedRemoteListId(remoteList.remoteListId)}>
                      <div>
                        <p className="font-medium">{remoteList.entryListName}</p>
                        <p className="text-xs text-muted-foreground">
                          ID: {remoteList.remoteListId}
                        </p>
                      </div>
                      <div className="h-4 w-4 rounded-full border border-muted" />
                    </button>
                  ))}
                </div>
              )}

              {importError ? <p className="text-sm text-destructive">{importError}</p> : null}

              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="secondary" onClick={closeImportDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImportSelectedList}
                  disabled={!selectedRemoteListId || isImporting || remoteLists.length === 0}>
                  {isImporting ? 'Importing…' : 'Import selected list'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {isLoadingLists ? (
          <Card className="animate-pulse">
            <CardContent>
              <div className="h-4 w-48 rounded-lg bg-muted" />
              <div className="mt-4 h-4 w-64 rounded-lg bg-muted" />
            </CardContent>
          </Card>
        ) : lists.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-sm text-muted-foreground">No lists found.</div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {lists.map(list => (
              <Card key={list.id} className="group hover:border-primary transition-colors">
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">
                        <Link to={`/lists/${list.id}`} className="hover:text-primary">
                          {list.title}
                        </Link>
                      </h2>
                      <p className="text-sm text-muted-foreground">{list.creator.username}</p>
                    </div>
                    <Badge variant="secondary">{list.itemCount} items</Badge>
                  </div>
                  {list.description ? (
                    <p className="text-sm text-muted-foreground">{list.description}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Created {new Date(list.createdAt).toLocaleDateString()}</span>
                    <span>Updated {new Date(list.updatedAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
