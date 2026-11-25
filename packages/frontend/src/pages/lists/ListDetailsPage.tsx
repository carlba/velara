import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AddListItemSearch from '@/components/lists/AddListItemSearch';
import ListHeaderMenu from '@/components/lists/ListHeaderMenu';
import ListItemCard from '@/components/lists/ListItemCard';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteList, useDeleteListItem, useListDetails } from '@/hooks/useListDetails';

export default function ListDetailsPage() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const numericListId = Number(listId);
  const { data: list, isLoading } = useListDetails(numericListId);
  const deleteListMutation = useDeleteList(numericListId);
  const deleteItemMutation = useDeleteListItem(numericListId);

  const isOwner = Boolean(user && list && user.id === list.creator.id);

  const handleDelete = () => {
    if (!window.confirm('Delete this list? This cannot be undone.')) return;

    deleteListMutation.mutate(undefined, { onSuccess: () => navigate('/lists') });
  };

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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="break-words text-3xl font-bold tracking-tight">{list.title}</h1>
          {list.description ? <p className="break-words">{list.description}</p> : null}
          <p className="text-muted-foreground">Created by {list.creator.username}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/lists">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to lists
            </Link>
          </Button>
          {isOwner ? <ListHeaderMenu list={list} onDelete={handleDelete} /> : null}
        </div>
      </div>

      <Card>
        <CardHeader className="gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Items</CardTitle>
            <CardDescription>
              {list.items.length} item{list.items.length === 1 ? '' : 's'} in this list.
            </CardDescription>
          </div>
          {isOwner ? <AddListItemSearch listId={list.id} /> : null}
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
                        onClick={() => deleteItemMutation.mutate(item.id)}>
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
  );
}
