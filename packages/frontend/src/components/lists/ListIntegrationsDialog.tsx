import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConnectListToFlexget, useDisconnectListFromFlexget } from '@/hooks/useListDetails';
import type { ListDetails } from '@/types/list';

interface ListIntegrationsDialogProps {
  list: ListDetails;
  onClose: () => void;
}

export default function ListIntegrationsDialog({ list, onClose }: ListIntegrationsDialogProps) {
  const [entryListName, setEntryListName] = useState(list.flexgetConnection?.entryListName ?? '');
  const [error, setError] = useState<string | null>(null);
  const connectMutation = useConnectListToFlexget(list.id);
  const disconnectMutation = useDisconnectListFromFlexget(list.id);

  const handleConnect = () => {
    if (!entryListName.trim()) {
      setError('Entry list name is required to connect.');
      return;
    }

    setError(null);
    connectMutation.mutate(entryListName.trim(), {
      onError: () => setError('Could not connect list to Flexget. Check integration settings.'),
    });
  };

  const handleDisconnect = () => {
    if (!window.confirm('Disconnect this list from Flexget?')) return;

    setError(null);
    disconnectMutation.mutate(undefined, {
      onSuccess: () => setEntryListName(''),
      onError: () => setError('Could not disconnect list from Flexget.'),
    });
  };

  const getConnectLabel = () => {
    if (connectMutation.isPending) return 'Connecting…';
    return list.flexgetConnection ? 'Update connection' : 'Connect list';
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flexget connection</DialogTitle>
          <DialogDescription>
            Connect this list to a Flexget entry list so new items are pushed automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-muted p-4">
          {list.flexgetConnection ? (
            <>
              <p className="text-sm text-muted-foreground">Connected entry list</p>
              <p className="font-medium">{list.flexgetConnection.entryListName}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This list is not connected to a Flexget entry list.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="entry-list-name">Flexget entry list name</Label>
          <Input
            id="entry-list-name"
            value={entryListName}
            onChange={event => setEntryListName(event.target.value)}
            placeholder="Example: My Downloads"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleConnect} disabled={connectMutation.isPending}>
            {getConnectLabel()}
          </Button>
          {list.flexgetConnection ? (
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnectMutation.isPending}>
              {disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
