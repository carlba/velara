import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useFlexgetRemoteLists, useImportFlexgetList } from '@/hooks/useListsOverview';
import { cn } from '@/lib/utils';

export default function ImportFlexgetListDialog({ onClose }: { onClose: () => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const remoteListsQuery = useFlexgetRemoteLists();
  const importMutation = useImportFlexgetList();
  const remoteLists = remoteListsQuery.data ?? [];

  const handleImport = () => {
    if (selectedId === null) return;

    importMutation.mutate(selectedId, { onSuccess: onClose });
  };

  const renderRemoteLists = () => {
    if (remoteListsQuery.isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-4 w-32" />
        </div>
      );
    }

    if (remoteListsQuery.isError) {
      return (
        <p className="text-sm text-destructive">
          Unable to load Flexget entry lists. Check your integration settings.
        </p>
      );
    }

    if (remoteLists.length === 0) {
      return (
        <p className="rounded-lg border border-muted p-4 text-sm text-muted-foreground">
          No Flexget entry lists were found. Make sure your Flexget integration is configured.
        </p>
      );
    }

    return (
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-muted p-2">
        {remoteLists.map(remoteList => (
          <button
            key={remoteList.remoteListId}
            type="button"
            aria-pressed={selectedId === remoteList.remoteListId}
            className={cn(
              'w-full rounded-lg border p-4 text-left transition',
              selectedId === remoteList.remoteListId
                ? 'border-primary bg-primary/10'
                : 'border-transparent hover:border-border'
            )}
            onClick={() => setSelectedId(remoteList.remoteListId)}>
            <p className="font-medium">{remoteList.entryListName}</p>
            <p className="text-xs text-muted-foreground">ID: {remoteList.remoteListId}</p>
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Flexget</DialogTitle>
          <DialogDescription>
            Select a remote Flexget entry list to import into Velara.
          </DialogDescription>
        </DialogHeader>

        {renderRemoteLists()}

        {importMutation.isError ? (
          <p className="text-sm text-destructive">{importMutation.error.message}</p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={selectedId === null || importMutation.isPending}>
            {importMutation.isPending ? 'Importing…' : 'Import selected list'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
