import { useState } from 'react';
import { Edit3, MoreVertical, Plug, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EditListDialog from './EditListDialog';
import ListIntegrationsDialog from './ListIntegrationsDialog';
import type { ListDetails } from '@/types/list';

type OpenDialog = 'edit' | 'integrations' | null;

interface ListHeaderMenuProps {
  list: ListDetails;
  onDelete: () => void;
}

export default function ListHeaderMenu({ list, onDelete }: ListHeaderMenuProps) {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const closeDialog = () => setOpenDialog(null);

  return (
    <>
      {/* Non-modal so the menu does not keep pointer events locked when a dialog opens. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="List actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setOpenDialog('edit')}>
            <Edit3 className="mr-2 h-4 w-4" /> Edit details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenDialog('integrations')}>
            <Plug className="mr-2 h-4 w-4" /> Integrations
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete list
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mounted on demand so each opening starts from the saved values. */}
      {openDialog === 'edit' ? <EditListDialog list={list} onClose={closeDialog} /> : null}
      {openDialog === 'integrations' ? (
        <ListIntegrationsDialog list={list} onClose={closeDialog} />
      ) : null}
    </>
  );
}
