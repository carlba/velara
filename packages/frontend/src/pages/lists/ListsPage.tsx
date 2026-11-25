import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CreateListDialog from '@/components/lists/CreateListDialog';
import ImportFlexgetListDialog from '@/components/lists/ImportFlexgetListDialog';
import { useAuth } from '@/hooks/useAuth';
import { useListsOverview } from '@/hooks/useListsOverview';

type OpenDialog = 'create' | 'import' | null;

export default function ListsPage() {
  const { user, isLoading } = useAuth();
  const [showMine, setShowMine] = useState(true);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const isShowingMine = Boolean(user) && showMine;
  const listsQuery = useListsOverview({ mine: isShowingMine, enabled: !isLoading });
  const lists = listsQuery.data ?? [];
  const isLoadingLists = isLoading || listsQuery.isLoading;
  const closeDialog = () => setOpenDialog(null);

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
          variant={isShowingMine ? 'default' : 'outline'}
          onClick={() => setShowMine(true)}
          disabled={!user || isLoadingLists}>
          My lists
        </Button>
        <Button
          variant={isShowingMine ? 'outline' : 'default'}
          onClick={() => setShowMine(false)}
          disabled={isLoadingLists}>
          All lists
        </Button>
        {user ? (
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button onClick={() => setOpenDialog('create')}>
              <Plus className="mr-2 h-4 w-4" /> Create new list
            </Button>
            <Button variant="secondary" onClick={() => setOpenDialog('import')}>
              <Download className="mr-2 h-4 w-4" /> Import from Flexget
            </Button>
          </div>
        ) : null}
      </div>

      {!isLoading && !user ? (
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
      ) : null}

      {openDialog === 'create' ? <CreateListDialog onClose={closeDialog} /> : null}
      {openDialog === 'import' ? <ImportFlexgetListDialog onClose={closeDialog} /> : null}

      {listsQuery.isError ? (
        <p className="text-sm text-destructive">Unable to load lists.</p>
      ) : null}

      <div className="space-y-4">
        {isLoadingLists ? (
          <Card className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-4 w-48 rounded-lg bg-muted" />
              <div className="mt-4 h-4 w-64 rounded-lg bg-muted" />
            </CardContent>
          </Card>
        ) : listsQuery.isError && lists.length === 0 ? null : lists.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">No lists found.</div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {lists.map(list => (
              <Link
                key={list.id}
                to={`/lists/${list.id}`}
                className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Card className="h-full transition-colors group-hover:border-primary">
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold">{list.title}</h2>
                        <p className="text-sm text-muted-foreground">{list.creator.username}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {list.itemCount} items
                      </Badge>
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
